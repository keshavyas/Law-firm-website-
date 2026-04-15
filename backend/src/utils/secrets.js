import AWS from "aws-sdk";

const ssm = new AWS.SSM({
  region: "eu-north-1" // your region
});

export const getSecret = async (name) => {
  const res = await ssm.getParameter({
    Name: name,
    WithDecryption: true
  }).promise();

  return res.Parameter.Value;
};