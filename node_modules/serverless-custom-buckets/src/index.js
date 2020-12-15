'use strict';

const get = (obj, path, defaultValue) => {
  return path
    .split('.')
    .filter(Boolean)
    .every(step => !(step && !(obj = obj[step])))
    ? obj
    : defaultValue;
};

const MAX_RETRIES = 3;

class CustomBucketPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.provider = this.serverless.providers.aws;
    this.customBuckets = get(
      this.serverless.service,
      'custom.customBuckets',
      []
    );
    this.hooks = {
      'before:package:setupProviderConfiguration': this.applyCustomBuckets.bind(
        this
      )
    };
    this.synchronousExec = this.synchronousExec.bind(this);
    this.maxRetries = MAX_RETRIES;
    this.logPrefix = 'Serverless Custom Bucket:';
  }

  resetMaxRetries() {
    this.maxRetries = MAX_RETRIES;
  }

  async makeRequestWithRetries({ operationName, params }) {
    const TYPE = 'S3';
    let response;

    try {
      response = await this.provider.request(TYPE, operationName, params);
      this.resetMaxRetries();
      return response;
    } catch (e) {
      if (e.statusCode === 404 && this.maxRetries > 0) {
        this.maxRetries -= 1;

        this.serverless.cli.log(
          `${this.logPrefix} Retrying operation '${operationName}'`
        );
        this.serverless.cli.log(
          `${this.logPrefix} Retries left = '${this.maxRetries}'`
        );
        response = await this.makeRequestWithRetries({ operationName, params });

        return response;
      } else {
        this.resetMaxRetries();
        throw e;
      }
    }
  }

  async bucketExists(name) {
    const params = {
      Bucket: name
    };

    try {
      await this.provider.request('S3', 'headBucket', params);
      return true;
    } catch (e) {
      return false;
    }
  }

  async waitFor(name, state) {
    const params = {
      Bucket: name
    };

    try {
      const service = new this.provider.sdk['S3'](
        this.provider.getCredentials()
      );
      await service.waitFor(state, params).promise();

      return true;
    } catch (e) {
      this.serverless.cli.log(`Unable to wait for '${state}' - ${e.message}`);

      return false;
    }
  }

  async createBucket(name) {
    const params = {
      Bucket: name,
      ACL: 'private'
    };

    return this.provider.request('S3', 'createBucket', params);
  }

  async hasBucketEncryption(name) {
    const params = {
      Bucket: name
    };

    try {
      await this.provider.request('S3', 'getBucketEncryption', params);

      return true;
    } catch (e) {
      return false;
    }
  }

  async putBucketEncryption(name, sseAlgorithm, kmsMasterKeyId) {
    const params = {
      Bucket: name,
      ServerSideEncryptionConfiguration: {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault: {
              SSEAlgorithm: sseAlgorithm,
              KMSMasterKeyID: kmsMasterKeyId
            }
          }
        ]
      }
    };

    return await this.makeRequestWithRetries({
      operationName: 'putBucketEncryption',
      params
    });
  }

  async hasBucketVersioning(name) {
    const params = {
      Bucket: name
    };

    try {
      const response = await this.provider.request(
        'S3',
        'getBucketVersioning',
        params
      );
      if (response.Status && response.Status == 'Enabled') {
        return true;
      }

      return false;
    } catch (e) {
      return false;
    }
  }

  async putBucketVersioning(name, status) {
    const params = {
      Bucket: name,
      VersioningConfiguration: {
        Status: status ? 'Enabled' : 'Suspended'
      }
    };

    return await this.makeRequestWithRetries({
      operationName: 'putBucketVersioning',
      params
    });
  }

  async putBucketPolicy(name, policy) {
    const params = {
      Bucket: name,
      Policy: JSON.stringify(policy)
    };

    return await this.makeRequestWithRetries({
      operationName: 'putBucketPolicy',
      params
    });
  }

  async putBucketPublicAccess(name, publicAccess) {
    const params = {
      Bucket: name,
      ...publicAccess
    };

    return await this.makeRequestWithRetries({
      operationName: 'putPublicAccessBlock',
      params
    });
  }

  async putBucketCors(name, cors) {
    const params = {
      Bucket: name,
      ...cors
    };

    return await this.makeRequestWithRetries({
      operationName: 'putBucketCors',
      params
    });
  }

  async synchronousExec(tasks, fn) {
    return tasks.reduce(
      (promise, task) => promise.then(previous => fn(task, previous)),
      Promise.resolve(null)
    );
  }

  async applyCustomBuckets() {
    try {
      await this.synchronousExec(this.customBuckets, async bucket => {
        const config = get(bucket, 'config', {});
        const bucketName = get(bucket, 'name', undefined);

        if (!bucketName) {
          this.serverless.cli.log(`${this.logPrefix} bucket name not provided`);
          return;
        }

        if (await this.bucketExists(bucketName)) {
          this.serverless.cli.log(
            `${this.logPrefix} (Existing) '${bucketName}'`
          );
        } else {
          this.serverless.cli.log(
            `${this.logPrefix} (Creating) '${bucketName}'`
          );
          await this.createBucket(bucketName);
          await this.waitFor(bucketName, 'bucketExists');
        }

        if (config.serverSideEncryption) {
          if (!(await this.hasBucketEncryption(bucketName))) {
            await this.putBucketEncryption(
              bucketName,
              config.serverSideEncryption
            );

            this.serverless.cli.log(
              `${this.logPrefix} Applied Server Side Encryption (${
                config.serverSideEncryption
              }) to custom bucket '${bucketName}'`
            );
          } else {
            this.serverless.cli.log(
              `${
                this.logPrefix
              } Custom bucket '${bucketName}' already has Server Side Encryption setup. (${
                config.serverSideEncryption
              }) has not been applied`
            );
          }
        }

        if (
          config.versioning !== undefined &&
          (await this.hasBucketVersioning(bucketName)) !== config.versioning
        ) {
          await this.putBucketVersioning(bucketName, config.versioning);

          if (config.versioning) {
            this.serverless.cli.log(
              `${
                this.logPrefix
              } Enabled versioning on custom bucket '${bucketName}'`
            );
          } else {
            this.serverless.cli.log(
              `${
                this.logPrefix
              } Suspended versioning on custom bucket '${bucketName}'`
            );
          }
        }

        if (config.policy) {
          await this.putBucketPolicy(bucketName, config.policy);
          this.serverless.cli.log(
            `${this.logPrefix} Applied custom bucket policy for '${bucketName}'`
          );
        }

        if (config.publicAccess) {
          await this.putBucketPublicAccess(bucketName, config.publicAccess);
          this.serverless.cli.log(
            `${
              this.logPrefix
            } Applied custom bucket public access for '${bucketName}'`
          );
        }

        if (config.cors) {
          await this.putBucketCors(bucketName, config.cors);
          this.serverless.cli.log(
            `${this.logPrefix} Applied custom bucket cors for '${bucketName}'`
          );
        }
      });
    } catch (e) {
      console.error(
        `\n-------- ${this.logPrefix} Custom Bucket Create Error --------\n${
          e.message
        }`
      );
    }
  }
}

module.exports = CustomBucketPlugin;
