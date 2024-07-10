
import * as cfn from 'aws-cdk-lib/aws-cloudformation';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BedrockModelInvocationLoggingProps } from '../../env/index';


interface BedrockModelInvocationLoggingStackSetsStackProps extends BedrockModelInvocationLoggingProps, cdk.StackProps {
  readonly stackSetBaseProps: cfn.CfnStackSetProps;
  readonly aggregationBucketStackTemplate: string;
  readonly loggingConfigurationStackTemplate: string;
}


export class BedrockModelInvocationLoggingSharedResourceStackSetsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BedrockModelInvocationLoggingStackSetsStackProps) {
    super(scope, id, props);
    const aggregationBucketStackSet = new cfn.CfnStackSet(this, 'AggregationBucketStackSet', {
      ...props.stackSetBaseProps,
      templateBody: props.aggregationBucketStackTemplate,
      stackSetName: `${props.resourcePrefix}-aggregation-bucket`,
      stackInstancesGroup: [
        {
          deploymentTargets: {
            organizationalUnitIds: [props.orgRootId,],
            accountFilterType: 'INTERSECTION',
            accounts: [props.logsAggregationAccountId,]
          },
          regions: [props.logsAggregationAccountRegion,]
        }
      ],
    });
  }
}


export class BedrockModelInvocationLoggingConfigurationStackSetsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BedrockModelInvocationLoggingStackSetsStackProps) {
    super(scope, id, props);
    const loggingConfigurationStackSet = new cfn.CfnStackSet(this, 'LoggingConfigurationStackSet', {
      ...props.stackSetBaseProps,
      templateBody: props.loggingConfigurationStackTemplate,
      stackSetName: `${props.resourcePrefix}-logging-configuration`,
      capabilities: ['CAPABILITY_NAMED_IAM',],
      stackInstancesGroup: [...props.modelInvocationLoggingAccounts],
    });
  }
}
