
import { CfnStackSet } from 'aws-cdk-lib/aws-cloudformation'


interface Tags {
  [key: string]: string;
}


export interface BedrockModelInvocationLoggingProps {
  readonly resourcePrefix: string;
  readonly textDataDeliveryEnabled: boolean;
  readonly imageDataDeliveryEnabled: boolean;
  readonly embeddingDataDeliveryEnabled: boolean;
  readonly orgId: string;
  readonly orgRootId: string;
  readonly logsAggregationAccountId: string;
  readonly logsAggregationAccountRegion: string;
  readonly modelInvocationLoggingAccounts: readonly CfnStackSet.StackInstancesProperty[];
  readonly tags?: Tags;
}


export interface EnvNamePropsMapping {
  [key: string]: BedrockModelInvocationLoggingProps;
}
