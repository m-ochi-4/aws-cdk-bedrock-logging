#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AggregationBucketStack } from '../lib/stack/aggregation-bucket';
import { LoggingConfigurationStack } from '../lib/stack/logging-configuration';
import { BedrockModelInvocationLoggingSharedResourceStackSetsStack, BedrockModelInvocationLoggingConfigurationStackSetsStack } from '../lib/stack/stacksets';
import { envNamePropsMapping } from '../env/map';


const app = new cdk.App();
cdk.Tags.of(app).add('audit', 'true');

const props = envNamePropsMapping[app.node.getContext('envName')];
Object.entries((props?.tags ?? {})).map(([key, value]) => cdk.Tags.of(app).add(key, value));


const s3ReplicationRoleNamePrefix = `${props.resourcePrefix}-replication`;
const s3ReplicationDestBucketName = `${props.resourcePrefix}-agg-${props.logsAggregationAccountId}-${props.logsAggregationAccountRegion}`;


const aggregationBucketStackStage = new cdk.Stage(app, 'AggregationBucketStackStage');
new AggregationBucketStack(aggregationBucketStackStage, 'AggregationBucketStack', {
  bucketName: s3ReplicationDestBucketName,
  s3ReplicationRoleNamePrefix,
  s3ReplicationSrcRegions: [...new Set(props.modelInvocationLoggingAccounts.flatMap(stackInstalcesProps => stackInstalcesProps.regions))].sort(),
  orgId: props.orgId,
  synthesizer: new cdk.DefaultStackSynthesizer({ generateBootstrapVersionRule: false }),
});
const aggregationBucketStackTemplate = JSON.stringify(aggregationBucketStackStage.synth().stacks[0].template);


const loggingConfigurationStackStage = new cdk.Stage(app, 'LoggingConfigurationStackStage');
new LoggingConfigurationStack(loggingConfigurationStackStage, 'LoggingConfigurationStack', {
  resourcePrefix: props.resourcePrefix,
  textDataDeliveryEnabled: props.textDataDeliveryEnabled,
  imageDataDeliveryEnabled: props.imageDataDeliveryEnabled,
  embeddingDataDeliveryEnabled: props.embeddingDataDeliveryEnabled,
  s3ReplicationRoleNamePrefix,
  logsAggregationAccountId: props.logsAggregationAccountId,
  s3ReplicationDestBucketName,
  synthesizer: new cdk.DefaultStackSynthesizer({ generateBootstrapVersionRule: false }),
});
const loggingConfigurationStackTemplate = JSON.stringify(loggingConfigurationStackStage.synth().stacks[0].template);


const stackSetBaseProps = {
  callAs: 'DELEGATED_ADMIN',
  permissionModel: 'SERVICE_MANAGED',
  administrationRoleArn: undefined,
  executionRoleName: undefined,
  templateUrl: undefined,
  templateBody: undefined,
  capabilities: undefined,
  stackSetName: '',
  description: undefined,
  parameters: undefined,
  tags: undefined,
  managedExecution: {
    Active: true,
  },
  stackInstancesGroup: undefined,
  autoDeployment: {
    enabled: true,
    retainStacksOnAccountRemoval: false,
  },
  operationPreferences: {
    maxConcurrentPercentage: 100,
    failureTolerancePercentage: 0,
    regionConcurrencyType: 'PARALLEL',
  },
};

const stackProps = {
  ...props,
  stackSetBaseProps,
  aggregationBucketStackTemplate,
  loggingConfigurationStackTemplate,
};

new BedrockModelInvocationLoggingSharedResourceStackSetsStack(app, 'BedrockModelInvocationLoggingSharedResourceStackSets', stackProps);

new BedrockModelInvocationLoggingConfigurationStackSetsStack(app, 'BedrockModelInvocationLoggingConfigurationStackSets', stackProps);
