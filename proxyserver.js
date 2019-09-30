// index.js
const http = require('http');
const hostname = '127.0.0.1';
const port = 5000;
var AWS = require('aws-sdk');
var apigClientFactory = require('aws-api-gateway-client').default;

var server = http.createServer((req, res) => {
    var apiUri = (req.url).substr(1);
    var body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    //var body = '{"part1": "lightning","part2": "grease"}';
    var mthd = (req.method);  //'POST'; //

    //Capture region from URI if provided, else use default of 'us-east-1'
    const localRegion = {
        host: '169.254.169.254',
        path: '/latest/dynamic/instance-identity/document',
        method: 'GET'
    };

    callbackRegion = function (response2) {
        const bufferRegion = [];
        response2.on('data', (data2) => {
            bufferRegion.push(data2.toString('utf8'));
        });
        response2.on('end', function () {
            const data2 = bufferRegion.join('');
            if (response2.statusCode >= 400) {
                console.log('ERROR: Non 200 status code recievd when requesting instance region.  Will default to us-east-1');
                console.log(data2);
                return;
            }
            retJson2 = JSON.parse(data2);
            console.log('here is query region:', retJson2.region);
            var defRegion = retJson2.region;
            var awsRegions = ["us-east-1", "us-east-2", "us-west-1", "us-west-2", "ca-central-1", "eu-west-1", "eu-central-1", "eu-west-2", "eu-west-3", "ap-northeast-1", "ap-northeast-2", "ap-southeast-1", "ap-southeast-2", "ap-south-1", "sa-east-1", "us-gov-west-1"];
            var i = 0;
            var lambdaRegion = 'no';

            while (i < awsRegions.length) {
                if (apiUri.includes(awsRegions[i])) {
                    defRegion = awsRegions[i];
                    lambdaRegion = 'yes';
                }
                i++;
            }

            // Derive Lambda funcion Name - default to us-east-1 if no region entered
            if (lambdaRegion == 'yes') {
                var regIndex = apiUri.indexOf(defRegion);
                var fxIndex = apiUri.indexOf("/", regIndex);
                lambdaName = apiUri.substring(fxIndex + 1);
            } else {
                lambdaName = apiUri;
            }

            const http_opts = {
                host: '169.254.169.254',
                path: '/latest/meta-data/iam/security-credentials/f5ApiProxyRole',
                method: 'GET'
            };
            callback = function (response) {
                const buffer = [];
                response.on('data', (data) => {
                    buffer.push(data.toString('utf8'));
                });
                response.on('end', function () {
                    const data = buffer.join('');
                    if (response.statusCode >= 400) {
                        console.log('ERROR: Non 200 status code recievd when fetching credentials.  Verify if appropriate IAM role "f5ApiProxyRole" has been attached to the BIGIP instance - https://aws.amazon.com/blogs/security/easily-replace-or-attach-an-iam-role-to-an-existing-ec2-instance-by-using-the-ec2-console/');
                        console.log(data);
                        return;
                    }
                    retJson = JSON.parse(data);
                    console.log(retJson);
                    AWS.config = new AWS.Config();
                    var accessKeyId = retJson.AccessKeyId;
                    var secretAccessKey = retJson.SecretAccessKey;
                    var sessionToken = retJson.Token;
                    AWS.config.update({ accessKeyId: accessKeyId, secretAccessKey: secretAccessKey, sessionToken: sessionToken, region: defRegion });

                    // Determine whether API or lambda function call based on URI presented
                    console.log('Calling subroutine');
                    // Defaulting to Lambda function Call
                    lambdaBody = body;
                    console.log(lambdaBody);
                    var lambda = new AWS.Lambda();
                        var params = {
                            FunctionName: lambdaName,   // required
                            Payload: lambdaBody
                        };
                        console.log(params);
                        lambda.invoke(params, function (err, data) {
                            if (err) res.end("1-failed");
                            else res.end(data.Payload);
                        });
                    });
                response.on('error', (err) => {
                    console.log("Error on index.js", err);
                    res.end("2-failed");
                });
            };
            http.request(http_opts, callback).end();
        });
        response2.on('error', (err) => {
            console.log("Error calling Region", err);
        });

    };
    http.request(localRegion, callbackRegion).end();
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
