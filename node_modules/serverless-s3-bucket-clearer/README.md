# serverless-s3-bucket-clearer
Serverless plugin to empty buckets and versioned buckets. 

# Usage
```bash
$ npm install serverless-s3-bucket-clearer
```

Add the following to your serverless yml template. 
```yaml

plugins:
    - serverless-s3-bucket-clearer

custom:
    s3clear:
        enabled: false # default enabled
        buckets: #list of buckets to be emptied
            - your-bucket-1  
            - your-bucket-2
```

### Removing a stack with the plugin enabled.

You can empty out the buckets with
```bash
$ sls s3clear
```

On removing a serverless stack the plugin will empty out buckets listed allowing for the buckets to be removed.

```bash
$ sls remove 
```

