
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';


interface LoggingConfigurationStackProps extends cdk.StackProps {
  readonly resourcePrefix: string;
  readonly keyPrefix?: string;
  readonly textDataDeliveryEnabled: boolean;
  readonly imageDataDeliveryEnabled: boolean;
  readonly embeddingDataDeliveryEnabled: boolean;
  readonly s3ReplicationRoleNamePrefix: string;
  readonly logsAggregationAccountId: string;
  readonly s3ReplicationDestBucketName: string;
}


export class LoggingConfigurationStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: LoggingConfigurationStackProps) {
    super(scope, id, props);

    const bucketName = `${props.resourcePrefix}-${cdk.Aws.ACCOUNT_ID}-${cdk.Aws.REGION}`;
    const functionNameDeleteObjects = `${props.resourcePrefix}-delete-objects`;
    const functionNameLoggingConfiguration = `${props.resourcePrefix}-logging-configuration`;

    const lambdaRoleName = `${props.resourcePrefix}-lambda-${cdk.Aws.REGION}`;
    const lambdaPolicy = new iam.Policy(this, 'LambdaPolicy', {
      document: iam.PolicyDocument.fromJson({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: iam.Effect.ALLOW,
            Action: [
              'bedrock:GetModelInvocationLoggingConfiguration',
              'bedrock:PutModelInvocationLoggingConfiguration',
              'bedrock:DeleteModelInvocationLoggingConfiguration',
            ],
            Resource: [
              '*',
            ],
          },
          {
            Effect: iam.Effect.ALLOW,
            Action: [
              's3:ListBucketVersions',
              's3:DeleteObjectVersion',
            ],
            Resource: [
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}`,
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}/*`,
            ],
          },
        ],
      }),
    });
    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      roleName: lambdaRoleName,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com', {
        conditions: {
          ArnEquals: {
            'aws:SourceArn': [
              `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:${functionNameDeleteObjects}`,
              `arn:${cdk.Aws.PARTITION}:lambda:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:function:${functionNameLoggingConfiguration}`,
            ],
          },
        },
      }),
    });
    lambdaRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaRole.attachInlinePolicy(lambdaPolicy);

    const s3ReplicationPolicy = new iam.Policy(this, 'S3ReplicationPolicy', {
      document: iam.PolicyDocument.fromJson({
        Version: '2012-10-17',
        Statement: [
          {
            Effect: iam.Effect.ALLOW,
            Action: [
              's3:ListBucket',
              's3:GetReplicationConfiguration',
              's3:GetObjectVersionForReplication',
              's3:GetObjectVersionAcl',
              's3:GetObjectVersionTagging',
              's3:GetObjectRetention',
              's3:GetObjectLegalHold',
            ],
            Resource: [
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}`,
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}/*`,
              `arn:${cdk.Aws.PARTITION}:s3:::${props.s3ReplicationDestBucketName}`,
              `arn:${cdk.Aws.PARTITION}:s3:::${props.s3ReplicationDestBucketName}/*`,
            ],
          },
          {
            Effect: iam.Effect.ALLOW,
            Action: [
              's3:ReplicateObject',
              's3:ReplicateDelete',
              's3:ReplicateTags',
              's3:ObjectOwnerOverrideToBucketOwner',
            ],
            Resource: [
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}/*`,
              `arn:${cdk.Aws.PARTITION}:s3:::${props.s3ReplicationDestBucketName}/*`,
            ],
          },
        ],
      }),
    });
    const s3ReplicationRole = new iam.Role(this, 'S3ReplicationRole', {
      roleName: `${props.s3ReplicationRoleNamePrefix}-${cdk.Aws.REGION}`,
      assumedBy: new iam.ServicePrincipal('s3.amazonaws.com', {
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
          ArnEquals: {
            'aws:SourceArn': [
              `arn:${cdk.Aws.PARTITION}:s3:::${bucketName}`,
            ],
          },
        },
      }),
    });
    s3ReplicationRole.attachInlinePolicy(s3ReplicationPolicy);

    const bucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      accessControl: s3.BucketAccessControl.PRIVATE,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
      lifecycleRules: [
        {
          enabled: true,
          expiration: cdk.Duration.days(1),
          noncurrentVersionExpiration: cdk.Duration.days(1),
        },
      ],
    });
    bucket.policy?.document.addStatements(
      new iam.PolicyStatement({
        sid: 'AmazonBedrockLogsWrite',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal('bedrock.amazonaws.com'),
        ],
        actions: [
          's3:PutObject',
        ],
        resources: [
          bucket.arnForObjects(`AWSLogs/${cdk.Aws.ACCOUNT_ID}/BedrockModelInvocationLogs/*`),
        ],
        conditions: {
          StringEquals: {
            'aws:SourceAccount': cdk.Aws.ACCOUNT_ID,
          },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`,
          },
        },
      }),
    );
    bucket.policy?.document.addStatements(
      new iam.PolicyStatement({
        sid: 'BlockNotAmazonBedrockLogsWrite',
        effect: iam.Effect.DENY,
        notPrincipals: [
          new iam.ServicePrincipal('bedrock.amazonaws.com'),
        ],
        actions: [
          's3:PutObject',
        ],
        resources: [
          bucket.arnForObjects(`*`),
        ],
        conditions: {
          ArnNotLike: {
            'aws:SourceArn': `arn:aws:bedrock:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:*`,
          },
        },
      }),
    );
    const cfnBucket = bucket.node.defaultChild;
    if (!cdk.CfnResource.isCfnResource(cfnBucket)) {
      throw new Error('');
    }
    cfnBucket.addPropertyOverride('ReplicationConfiguration', {
      Role: s3ReplicationRole.roleArn,
      Rules: [
        {
          Status: 'Enabled',
          Priority: 0,
          Filter: {},
          Destination: {
            Account: props.logsAggregationAccountId,
            Bucket: `arn:aws:s3:::${props.s3ReplicationDestBucketName}`,
            AccessControlTranslation: {
              Owner: 'Destination',
            },
          },
          DeleteMarkerReplication: {
            Status: 'Disabled',
          },
        },
      ],
    });


    const lambdaFunctionDeleteObjects = new lambda.Function(this, 'FunctionDeleteObjects', {
      functionName: functionNameDeleteObjects,
      code: lambda.Code.fromInline(fs.readFileSync(
        path.join(__dirname, '..', '..', 'lambda', 'delete-objects', 'index.cjs'),
        { encoding: 'utf8', },
      )),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(300),
      role: lambdaRole,
    });

    const customResourceDeleteObjects = new cdk.CustomResource(this, 'CustomDeleteObjects', {
      serviceToken: lambdaFunctionDeleteObjects.functionArn,
      properties: {
        ServiceTimeout: '300',
        bucketName: bucket.bucketName,
      },
    });
    customResourceDeleteObjects.node.addDependency(bucket);


    const lambdaFunctionLoggingConfiguration = new lambda.Function(this, 'Function', {
      functionName: functionNameLoggingConfiguration,
      code: lambda.Code.fromInline(fs.readFileSync(
        path.join(__dirname, '..', '..', 'lambda', 'bedrock-model-invocation-logging-configuration', 'index.cjs'),
        { encoding: 'utf8', },
      )),
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      architecture: lambda.Architecture.ARM_64,
      memorySize: 128,
      timeout: cdk.Duration.seconds(120),
      role: lambdaRole,
    });

    const customResourceLoggingConfiguration = new cdk.CustomResource(this, 'CustomLoggingConfiguration', {
      serviceToken: lambdaFunctionLoggingConfiguration.functionArn,
      properties: {
        ServiceTimeout: '120',
        bucketName: bucket.bucketName,
        keyPrefix: props.keyPrefix,
        textDataDeliveryEnabled: props.textDataDeliveryEnabled,
        imageDataDeliveryEnabled: props.imageDataDeliveryEnabled,
        embeddingDataDeliveryEnabled: props.embeddingDataDeliveryEnabled,
      },
    });
    if (bucket.policy) {
      customResourceLoggingConfiguration.node.addDependency(bucket.policy);
    }
    customResourceLoggingConfiguration.node.addDependency(customResourceDeleteObjects);
  }
}
