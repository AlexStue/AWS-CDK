import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class NewPublicSubnetStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Reference the existing VPC by its ID (you can also use VPC name if needed)
    const vpcId = 'vpc-05d64cdbb3ad8727c'; // replace with your VPC ID
    const vpc = ec2.Vpc.fromLookup(this, 'ExistingVPC', {
      vpcId: vpcId,
    });

    // 2. Create a new public subnet in the existing VPC
    const newPublicSubnet = new ec2.Subnet(this, 'Public Subnet AZ3', {
      vpcId: vpc.vpcId, // ensure the new subnet is created in the existing VPC
      cidrBlock: '10.0.6.0/24', // specify the CIDR block for the new subnet
      availabilityZone: 'eu-central-1c', // choose the Availability Zone
    });

    // Optionally, create a route to the Internet Gateway for the public subnet
    //const internetGateway = new ec2.CfnInternetGateway(this, 'InternetGateway');
    //new ec2.CfnVPCGatewayAttachment(this, 'VpcGatewayAttachment', {
    //  vpcId: vpc.vpcId,
    //  internetGatewayId: internetGateway.ref,
    //});
  }
}

const app = new cdk.App();
new NewPublicSubnetStack(app, 'NewPublicSubnetStack');
