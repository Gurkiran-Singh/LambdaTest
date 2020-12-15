const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const checkBucketExists = (Bucket) =>
    new Promise((resolve, reject) => {
        s3.headBucket({ Bucket }, (err) => {
            if (err) {
                if (err.statusCode === 404) {
                    resolve(false);
                }
                reject(err);
            }
            resolve(true);
        });
    });
const getBucketObjects = (Bucket) =>
    new Promise((resolve, reject) => {
        s3.listObjectVersions({ Bucket }, (err, data) => {
            if (err) {
                reject(err);
            }
            const { IsTruncated } = data;
            const versions = data.Versions.map((obj) => ({ Key: obj.Key, VersionId: obj.VersionId }));
            const deleteMarkers = data.DeleteMarkers.map((obj) => ({ Key: obj.Key, VersionId: obj.VersionId }));
            resolve({ IsTruncated, bucketObjects: versions.concat(deleteMarkers) });
        });
    });

const deleteBucketObjects = (bucket, bucketObjects) =>
    new Promise((resolve, reject) => {
        s3.deleteObjects({ Bucket: bucket, Delete: { Objects: bucketObjects } }, (err, data) => {
            if (err) {
                reject(err);
            }
            resolve(data);
        });
    });

const removeAllObjects = async (bucket, serverless) => {
    const { IsTruncated, bucketObjects } = await getBucketObjects(bucket, serverless);
    await deleteBucketObjects(bucket, bucketObjects);
    if (IsTruncated) {
        serverless.cli.log(`${bucket} isTruncated doing recursive call`);
        await removeAllObjects(bucket, serverless);
    } else {
        return (`${bucket} emptied`);
    }
};


const clearBuckets = async (serverless, options) => {
    const { s3clear: s3ClearOptions } = serverless.service.custom;
    if (s3ClearOptions.enabled === false) {
        serverless.cli.log('Skipping serverless-s3-clearer as enabled set to false');
        return;
    }
    if (s3ClearOptions && s3ClearOptions.buckets) {
        for (const bucket of s3ClearOptions.buckets) {
            try {
                if (await checkBucketExists(bucket)) {
                    const result = await removeAllObjects(bucket, serverless);
                    serverless.cli.log(`${result}`);
                } else {
                    serverless.cli.log(bucket, 'does not exist');
                }
            } catch (err) {
                console.log('ERROR', err);
            }
        }
    }
};

class s3ClearerPlugin {
    constructor(serverless, options) {
        this.serverless = serverless;
        this.options = options;
        this.commands = {
            s3clear: {
                lifecycleEvents: ['remove'],
            },
        };
        this.hooks = {
            'before:remove:remove': clearBuckets.bind(null, serverless, options),
            's3clear:remove': clearBuckets.bind(null, serverless, options),
        };
    }
}

module.exports = s3ClearerPlugin;
