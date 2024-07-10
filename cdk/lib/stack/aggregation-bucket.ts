
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';


interface AggregationBucketStackProps extends cdk.StackProps {
  readonly bucketName: string;
  readonly s3ReplicationRoleNamePrefix: string;
  readonly s3ReplicationSrcRegions: readonly string[];
  readonly orgId: string;
}


export class AggregationBucketStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AggregationBucketStackProps) {
    super(scope, id, props);

    const aggregationBucket = new s3.Bucket(this, 'AggregationBucket', {
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      bucketName: props.bucketName,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      bucketKeyEnabled: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      accessControl: s3.BucketAccessControl.PRIVATE,
      enforceSSL: true,
      minimumTLSVersion: 1.2,
    });

    const principalArns = props.s3ReplicationSrcRegions.map(region => `arn:aws:iam::*:role/${props.s3ReplicationRoleNamePrefix}-${region}`);

    // https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication-walkthrough-2.html
    aggregationBucket.policy?.document.addStatements(
      new iam.PolicyStatement({
        sid: 'Set-permissions-for-objects',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.AnyPrincipal(),
        ],
        actions: [
          's3:ReplicateObject',
          's3:ReplicateDelete',
        ],
        resources: [
          aggregationBucket.arnForObjects('*'),
        ],
        conditions: {
          ArnLike: {
            'aws:PrincipalArn': principalArns,
          },
          StringEquals: {
            'aws:PrincipalOrgID': props.orgId,
          },
        },
      }),
      new iam.PolicyStatement({
        sid: 'Set permissions on bucket',
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.AnyPrincipal(),
        ],
        actions: [
          's3:GetBucketVersioning',
          's3:PutBucketVersioning',
        ],
        resources: [
          aggregationBucket.bucketArn,
        ],
        conditions: {
          ArnLike: {
            'aws:PrincipalArn': principalArns,
          },
          StringEquals: {
            'aws:PrincipalOrgID': props.orgId,
          },
        },
      }),
    );
  }
}