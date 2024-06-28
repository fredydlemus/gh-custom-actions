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

        core.info('Fetching OIDC token...');
        const idToken = await core.getIDToken(oidcAudience);

        core.info(`Assuming role: ${roleArn}`);
        let assumeRoleOutput = '';
        let assumeRoleError = '';
        await exec.exec(`aws sts assume-role-with-web-identity --role-arn ${roleArn} --role-session-name deploy-s3-javascript-action --web-identity-token ${idToken} --duration-seconds 3600`, [], {
            listeners: {
                stdout: (data) => {
                    assumeRoleOutput += data.toString();
                },
                stderr: (data) => {
                    assumeRoleError += data.toString();
                }
            }
        });

        core.info(`Assume role output: ${assumeRoleOutput}`);
        if (assumeRoleError) {
            core.error(`Assume role error: ${assumeRoleError}`);
            throw new Error(assumeRoleError);
        }
    
        // let credentials = '';
        // core.info('Getting session token...');
        // await exec.exec(`aws sts get-session-token`, [], {
        //     listeners: {
        //         stdout: (data) => {
        //             credentials += data.toString();
        //         },
        //         stderr: (data) =>{
        //             core.error(data.toString());
        //         }
        //     },
        // });

        // core.info(`Session token output: ${credentials}`);
    
        const creds = JSON.parse(assumeRoleOutput);
        const accessKeyId = assumeRoleOutput.Credentials.AccessKeyId;
        const secretAccessKey = assumeRoleOutput.Credentials.SecretAccessKey;
        const sessionToken = assumeRoleOutput.Credentials.SessionToken;
    
        core.exportVariable('AWS_ACCESS_KEY_ID', accessKeyId);
        core.exportVariable('AWS_SECRET_ACCESS_KEY', secretAccessKey);
        core.exportVariable('AWS_SESSION_TOKEN', sessionToken);
    
        const s3Uri = `s3://${bucket}`;
        core.info(`Syncing folder ${distFolder} to ${s3Uri}`);
        await exec.exec(`aws s3 sync ${distFolder} ${s3Uri} --region ${bucketRegion}`, [], {
            listeners: {
                stdout:(data) => {
                    core.info(data.toString());
                },
                stderr: (data) => {
                    core.error(data.toString());
                }
            }
        })
    
        core.notice('Hello from my custom Javascript Action!');
    }
    catch (error) {
        core.setFailed(error.message);
    }
}

run();