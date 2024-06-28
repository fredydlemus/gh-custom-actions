const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

async function run() {
    try{
        const bucket = core.getInput('bucket', {required: true});
        const bucketRegion = core.getInput('bucket-region', {required: true});
        const distFolder = core.getInput('dist-folder', {required: true});
        const roleArn = core.getInput('role-arn', {required: true});
    
        await exec.exec(`aws sts assume-role --role-arn ${roleArn} --role-session-name deploy-s3-javascript-action`);
    
        let credentials = '';
        exec.exec(`aws sts get-session-token`, [], {
            listeners: {
                stdout: (data) => {
                    credentials += data.toString();
                }
            },
        });
    
        const creds = JSON.parse(credentials);
        const accessKeyId = creds.Credentials.AccessKeyId;
        const secretAccessKey = creds.Credentials.SecretAccessKey;
        const sessionToken = creds.Credentials.SessionToken;
    
        core.exportVariable('AWS_ACCESS_KEY_ID', accessKeyId);
        core.exportVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey);
        core.exportVariable('AWS_SESSION_TOKEN', sessionToken);
    
        const s3Uri = `s3://${bucket}`;
        exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion}`)
    
        core.notice('Hello from my custom Javascript Action!');
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();