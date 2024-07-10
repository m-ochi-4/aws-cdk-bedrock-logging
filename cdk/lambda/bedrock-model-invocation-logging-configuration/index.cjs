
const bedrock = require('@aws-sdk/client-bedrock');
const cfnresponse = require('cfn-response');


const client = new bedrock.BedrockClient({ maxAttempts: 4, });


const toBoolean = val =>
  typeof (val) === 'string'
    ? val.toLowerCase() === 'true'
    : !!val;


exports.handler = async (event, context) => {

  console.info(JSON.stringify(event));

  try {

    const resourceProperties = event.ResourceProperties;
    const bucketName = resourceProperties.bucketName;
    const keyPrefix = resourceProperties?.keyPrefix ?? undefined;
    const textDataDeliveryEnabled = toBoolean(resourceProperties?.textDataDeliveryEnabled);
    const imageDataDeliveryEnabled = toBoolean(resourceProperties?.imageDataDeliveryEnabled);
    const embeddingDataDeliveryEnabled = toBoolean(resourceProperties?.embeddingDataDeliveryEnabled);

    switch (event.RequestType) {

      case 'Create':
      case 'Update':
        await client.send(new bedrock.PutModelInvocationLoggingConfigurationCommand({
          loggingConfig: {
            s3Config: {
              bucketName,
              keyPrefix,
            },
            textDataDeliveryEnabled,
            imageDataDeliveryEnabled,
            embeddingDataDeliveryEnabled,
          },
        }));
        break;

      case 'Delete':
        await client.send(new bedrock.DeleteModelInvocationLoggingConfigurationCommand({}));
        break;

      default:
        throw new Error(`Invalid RequestType: ${event.RequestType}`);
    }

    await cfnresponse.send(event, context, cfnresponse.SUCCESS, {});
  }
  catch (error) {
    console.error(error);
    await cfnresponse.send(event, context, cfnresponse.FAILED, {});
  }
};
