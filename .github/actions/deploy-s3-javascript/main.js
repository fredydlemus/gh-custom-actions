const core = require('@actions/core');
const github = require('@actions/github');
const exec = require('@actions/exec');

async function run() {
    try{
        const bucket = core.getInput('bucket', {required: true});
        const bucketRegion = core.getInput('bucket-region', {required: true});
        const distFolder = core.getInput('dist-folder', {required: true});
        const roleArn = core.getInput('role-arn', {required: true});
        const oidcAudience = core.getInput('oidc-audience', {required: true});

        core.exportVariable('AWS_REGION', bucketRegion);
 
        const idToken = await core.getIDToken(oidcAudience);

        let assumeRoleOutput = '';
        await exec.exec(`aws sts assume-role-with-web-identity --role-arn ${roleArn} --role-session-name deploy-s3-javascript-action --web-identity-token ${idToken} --duration-seconds 3600`, [], {
            listeners: {
                stdout: (data) => {
                    assumeRoleOutput += data.toString();
                },
            }
        });

        const creds = JSON.parse(assumeRoleOutput);
        const accessKeyId = creds.Credentials.AccessKeyId;
        const secretAccessKey = creds.Credentials.SecretAccessKey;
        const sessionToken = creds.Credentials.SessionToken;
    
        core.exportVariable('AWS_ACCESS_KEY_ID', accessKeyId);
        core.exportVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey);
        core.exportVariable('AWS_SESSION_TOKEN', sessionToken);
    
        const s3Uri = `s3://${bucket}`;
        core.info(`Syncing folder ${distFolder} to ${s3Uri}`);
        await exec.exec(`aws s3 sync ${distFolder} ${s3Uri}`, [], {
            listeners: {
                stdout:(data) => {
                    core.info(data.toString());
                }
            }
        })
    
        const websiteUrl = `http://${bucket}.s3-website-${bucketRegion}.amazonaws.com`;
        core.setOutput('website-url', websiteUrl);
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();