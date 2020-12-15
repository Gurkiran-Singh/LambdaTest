# serverless-custom-buckets

Create and configure multiple custom s3 buckets

## Purpose

When you create an S3 bucket as a resource in [Serverless](https://https://serverless.com), it means the S3 bucket lifecycle is controlled by [Cloud Formation](https://aws.amazon.com/cloudformation/). This could introduce a problem if you want to keep the bucket beyond the life of the Cloud Formation stack. This could also introduce a problem when you delete the Cloud Formation stack but fail to delete the S3 bucket. When you try and re-create the Cloud Formation stack, it would fail because the bucket already exists.

This plugin aims to solve the above problems by allowing you to create your custom bucket(s) if it doesn't exist, update the the bucket(s) if it exists, and optionally configure server-side encryption, versioning, public access, policy and cors.

## Install

`yarn add serverless-custom-buckets --dev`

`npm install serverless-custom-buckets --save-dev`

## Configuration

Add the plugin to your `serverless.yml`:

```yaml
plugins:
  - serverless-custom-buckets
```

Configure the `customBuckets` property on custom:

```yaml
custom:
  customBuckets:
    - name: test-bucket-1
```

Optionally add custom configuration properties:

```yaml
custom:
  customBuckets:
    - name: test-bucket-1
      config:
        versioning: true
        serverSideEncryption: AES256
        publicAccess:
          PublicAccessBlockConfiguration:
            BlockPublicAcls: true
            BlockPublicPolicy: true
            IgnorePublicAcls: true
            RestrictPublicBuckets: true
        cors:
          CORSConfiguration:
            CORSRules:
              - AllowedHeaders:
                  - '*'
                AllowedMethods:
                  - 'HEAD'
                AllowedOrigins:
                  - '*'
                MaxAgeSeconds: 3000
```

| Property                      | Required | Type      | Default | Description                                |
| ----------------------------- | -------- | --------- | ------- | ------------------------------------------ |
| `name`                        | `true`   | `string`  |         | Name of the bucket                         |
| `config.serverSideEncryption` | `true`   | `string`  |         | Server Side Encryption bucket              |
| `config.versioning`           | `false`  | `boolean` |         | Enable versioning on the deployment bucket |
| `config.publicAccess`         | `false`  | `object`  |         | Bucket public access as JSON               |
| `config.policy`               | `false`  | `object`  |         | Bucket policy as JSON                      |
| `config.cors`                 | `false`  | `object`  |         | Bucket cors as JSON                        |

## Usage

Configuration of your `serverless.yml` is all you need.

There are no custom commands, just run: `sls deploy`
