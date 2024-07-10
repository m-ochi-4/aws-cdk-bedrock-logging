
const s3 = require('@aws-sdk/client-s3')
const cfnresponse = require('cfn-response');


const client = new s3.S3Client({ maxAttempts: 8, });


exports.handler = async (event, context) => {

  console.info(JSON.stringify(event));

  try {

    const resourceProperties = event.ResourceProperties;
    const Bucket = resourceProperties.bucketName;

    if (event.RequestType === 'Delete') {

      while (true) {

        const responseListObjects = await client.send(new s3.ListObjectVersionsCommand({ Bucket, }));

        const hasObjects = !!responseListObjects?.Versions?.length
        const hasDeleteMarkers = !!responseListObjects?.DeleteMarkers?.length

        if (!hasObjects && !hasDeleteMarkers) {
          break;
        }

        if (hasObjects) {
          await client.send(new s3.DeleteObjectsCommand({
            Bucket,
            Delete: {
              Objects: responseListObjects.Versions.map(version => ({ Key: version.Key, VersionId: version.VersionId, })),
            }
          }));
        }

        if (hasDeleteMarkers) {
          await client.send(new s3.DeleteObjectsCommand({
            Bucket,
            Delete: {
              Objects: responseListObjects.DeleteMarkers.map(deleteMarker => ({ Key: deleteMarker.Key, VersionId: deleteMarker.VersionId, })),
            }
          }));
        }
      }
    }
    await cfnresponse.send(event, context, cfnresponse.SUCCESS, {});
  }
  catch (error) {
    console.error(error);
    await cfnresponse.send(event, context, cfnresponse.FAILED, {});
  }
};
