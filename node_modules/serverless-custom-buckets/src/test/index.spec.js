const CustomBucketPlugin = require('..');
const Serverless = require('serverless/lib/Serverless');
const AwsProvider = jest.genMockFromModule(
  'serverless/lib/plugins/aws/provider/awsProvider'
);
const CLI = jest.genMockFromModule('serverless/lib/classes/CLI');

describe('CustomBucketPlugin', () => {
  let plugin;
  let serverless;
  let options;

  beforeEach(() => {
    serverless = new Serverless();
    serverless.service.service = 'my-service';
    options = {};
    serverless.setProvider('aws', new AwsProvider(serverless));
    serverless.cli = new CLI(serverless);
  });

  describe('Given a `constructor` function', () => {
    beforeEach(() => {
      plugin = new CustomBucketPlugin(serverless, options);
    });

    it('should set the provider to instance of AwsProvider', () => {
      expect(plugin.provider).toBeInstanceOf(AwsProvider);
    });

    it('should have access to the serverless instance', () => {
      expect(plugin.serverless).toEqual(serverless);
    });

    it('should set hooks', () => {
      expect(plugin.hooks).toHaveProperty(
        'before:package:setupProviderConfiguration'
      );
    });
  });

  describe('Given a customBuckets configuration is not provided', () => {
    it('should default to empty plugin config if missing "custom.customBuckets"', () => {
      serverless.service.custom.customBuckets = undefined;
      plugin = new CustomBucketPlugin(serverless, options);

      expect(plugin.customBuckets).toEqual([]);
    });
  });

  describe('Given a customBuckets configuration is provided', () => {
    beforeEach(() => {
      serverless.service.custom.customBuckets = [
        {
          name: 'test-bucket',
          config: {
            versioning: true,
            serverSideEncryption: 'AES256'
          }
        }
      ];
      plugin = new CustomBucketPlugin(serverless, options);
    });

    it('should set the plugin config', () => {
      expect(plugin.customBuckets).toBeTruthy();
    });
  });

  describe('Given a `applyCustomBuckets` function', () => {
    let mockWaitFor;

    beforeEach(() => {
      serverless.service.custom.customBuckets = [
        {
          name: 'test-bucket',
          config: {
            versioning: true,
            serverSideEncryption: 'AES256'
          }
        }
      ];

      plugin = new CustomBucketPlugin(serverless, options);
      mockWaitFor = jest.fn((state, params, callback) => {
        return {
          promise: jest.fn(() => {
            return new Promise((resolve, reject) => {
              resolve();
            });
          })
        };
      });

      plugin.provider.sdk = {
        S3: jest.fn(credentials => {
          return {
            waitFor: mockWaitFor
          };
        })
      };
    });

    it('should log info when bucket name is not configured', async () => {
      serverless.service.custom.customBuckets = [
        {
          config: {
            versioning: true,
            serverSideEncryption: 'AES256'
          }
        }
      ];
      plugin = new CustomBucketPlugin(serverless, options);
      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('bucket name not provided')
      );
    });

    it('should log info when creating a custom bucket', async () => {
      plugin.provider.request.mockResolvedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`(Existing) 'test-bucket'`)
      );
    });

    it('should log info when using existing custom bucket', async () => {
      plugin.provider.request.mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`(Creating) 'test-bucket'`)
      );
    });

    it('should log info when Server Side Encryption is applied to custom bucket', async () => {
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Applied Server Side Encryption')
      );
    });

    it('should log info when Server Side Encryption is not applied to custom bucket', async () => {
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(
          `Custom bucket 'test-bucket' already has Server Side Encryption`
        )
      );
    });

    it('should not apply Server Side Encryption if not configured on provider', async () => {
      plugin.customBuckets[0].config.serverSideEncryption = undefined;
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applied Server Side Encryption')
      );
    });

    it('should log info when versioning is applied to custom bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          Status: 'Suspended'
        });

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Enabled versioning')
      );
    });

    it('should suspend versioning when versioning is not already suspended on custom bucket', async () => {
      plugin.customBuckets[0].config.versioning = false;
      plugin.provider.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          Status: 'Enabled'
        });

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Suspended versioning')
      );
    });

    it('should not enable versioning when versioning is already enabled on custom bucket', async () => {
      plugin.provider.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({
          Status: 'Enabled'
        });

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Enabled versioning')
      );
    });

    it('should not apply versioning when versioning is undefined on custom bucket', async () => {
      plugin.customBuckets[0].config.versioning = undefined;
      plugin.provider.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Enabled versioning')
      );
      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Suspended versioning')
      );
    });

    it('should log error when exception caught', async () => {
      const spy = jest.spyOn(console, 'error');
      const errorMessage = 'Some AWS provider error';
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockRejectedValueOnce(new Error(errorMessage));

      await plugin.applyCustomBuckets();

      expect(spy).toHaveBeenLastCalledWith(
        expect.stringContaining(errorMessage)
      );
    });

    it(`should retry '3' times when '404' exception caught`, async () => {
      const putSpy = jest.spyOn(plugin, 'putBucketVersioning');
      const requestSpy = jest.spyOn(plugin, 'makeRequestWithRetries');
      const error = {
        message: 'The specified bucket does not exist',
        code: 'NoSuchBucket',
        statusCode: 404
      };

      plugin.provider.request
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error)
        .mockRejectedValueOnce(error);

      await plugin.applyCustomBuckets();

      expect(putSpy).toHaveBeenCalledTimes(1);
      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`Retrying operation 'putBucketVersioning'`)
      );
      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`Retries left = '2'`)
      );
      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`Retries left = '1'`)
      );
      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining(`Retries left = '0'`)
      );
      expect(requestSpy).toHaveBeenCalledTimes(4);
      expect(plugin.maxRetries).toEqual(3);
    });

    it('should wait for bucket to exist', async () => {
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(mockWaitFor).toHaveBeenCalled();
    });

    it('should not apply bucket policy if not configured', async () => {
      plugin.customBuckets[0].config.policy = undefined;
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket policy for')
      );
    });

    it('should apply bucket policy if configured', async () => {
      plugin.customBuckets[0].config.policy = '{}';
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket policy for')
      );
    });

    it('should not apply bucket public access if not configured', async () => {
      plugin.customBuckets[0].config.publicAccess = undefined;
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket public access for')
      );
    });

    it('should apply bucket public access if configured', async () => {
      plugin.customBuckets[0].config.publicAccess = {};
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket public access for')
      );
    });

    it('should not apply bucket cors if not configured', async () => {
      plugin.customBuckets[0].config.cors = undefined;
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket cors for')
      );
    });

    it('should apply bucket cors if configured', async () => {
      plugin.customBuckets[0].config.cors = {};
      plugin.provider.request
        .mockRejectedValueOnce({})
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce({});

      await plugin.applyCustomBuckets();

      expect(plugin.serverless.cli.log).toHaveBeenCalledWith(
        expect.stringContaining('Applied custom bucket cors for')
      );
    });
  });
});
