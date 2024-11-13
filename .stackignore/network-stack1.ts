import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class MyVpcAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Specify the desired Availability Zones explicitly
    const availabilityZones = ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'];

    // Create the VPC
    new ec2.Vpc(this, 'MyVpc', {
      natGateways: 1,
      subnetConfiguration: [
        {
          subnetType: ec2.SubnetType.PUBLIC,
          name: 'PublicSubnet',
          cidrMask: 24,
        },
        {
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          name: 'PrivateSubnet',
          cidrMask: 24,
        },
      ],
      // Specify the AZs to use for the VPC
      availabilityZones: availabilityZones, // Use explicit AZs
    });
  }
}
