import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
//import * as iam from 'aws-cdk-lib/aws-iam';
//import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
//import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import { Construct } from 'constructs';

// Define MultiRegionStackProps with a stricter type for env
interface MultiRegionStackProps extends cdk.StackProps {
  env: {
    region: string;  // Region for deployment
    account: string; // AWS Account ID
  };
}

export class MultiRegionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MultiRegionStackProps) {
    super(scope, id, props);

    const region = props.env.region;
    console.log(`Deploying resources to region: ${region}`);

// ------------------------------------ List
/*

cdk synth -all
cdk deploy -all
cdk destroy -all

cdk deploy -all --require-approval never
cdk destroy -all --require-approval never

Manual Stuff:
- Security Group

1. VPC in Regions

2. Public
  2.1 AZ Zones & IP
  2.2 Public Subnet
  2.2 Internet Gateway
  2.4 Route Table
    Add Route: 0.0.0.0/0
    Add Target: Internet Gateway
    Associate with Public Subnets
  2.5 Security Group
    Inbound: (all)
    Outbound: (all)

3. Private
  3.1 AZ Zones & IP
  3.2 NAT Gateway
    Subnet: Public Subnet
    Allocate Elastic IP
  3.3 Private Subnet
    Create Subents
    Create Route Table: 0.0.0.0/0
    Add Targets to each NAT Gateway in Private Subnets
    Associate with Private Subents

4. EC2 Instances
  4.1 Security Group
  4.2 IAM Role (for SSM)
  4.3 Instance per Private Subnet

5. Loadbalancer
  5.1 ALB
  5.2 Security Group
    Inbound: 80
    Outbound: 80
    Attach to ALB
  5.3 Target Group
    Create
    Register Instances
  5.4 Listener
    Port 80
*/

// ------------------------------------ Private

// Define only the VPC
    const vpc = new ec2.CfnVPC(this, `Vpc-${region}`, {
      cidrBlock: '10.0.0.0/16', // Define the CIDR block
      tags: [
        {
          key: 'Name',
          value: `Vpc-ProjectOne-${region}`, // Name the VPC
        },
      ],
    });

    // Optionally output the VPC ID
    new cdk.CfnOutput(this, `VpcIdOutput-${region}`, {
      value: vpc.ref,
      description: `VPC ID for region ${region}`,
    });
  
// Availability Zones
    const publicSubnets: ec2.CfnSubnet[] = [];  // Define an array to hold the public subnets
    const publicSubnetConfigs = [
      { availabilityZone: `${region}a`, cidrBlock: '10.0.1.0/24' },
      { availabilityZone: `${region}b`, cidrBlock: '10.0.4.0/24' },
    ];

// Internet Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, `InternetGateway-${region}`, {
      tags: [
        {
          key: 'Name',
          value: `InternetGateway-${region}`,
        },
      ],
    });
    new ec2.CfnVPCGatewayAttachment(this, `AttachGateway-${region}`, {
      vpcId: vpc.ref,
      internetGatewayId: internetGateway.ref,
    });

// Route Table
    const publicRouteTable = new ec2.CfnRouteTable(this, `PublicRouteTable-${region}`, {
      vpcId: vpc.ref,
      tags: [
        {
          key: 'Name',
          value: `PublicRouteTable-${region}`,
        },
      ],
    });

    // Route and Target
    new ec2.CfnRoute(this, `PublicSubnetRouteTarget-${region}`, {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0', // Route for all outbound traffic
      gatewayId: internetGateway.ref,    // Direct to Internet Gateway
    });

// Public Subnets
    publicSubnetConfigs.forEach((config, index) => {
      // Create Public Subnet
      const publicSubnet = new ec2.CfnSubnet(this, `PublicSubnet-${region}-${index + 1}`, {
        vpcId: vpc.ref,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        mapPublicIpOnLaunch: true, // Auto-assign public IPs to instances in the subnet
        tags: [
          {
            key: 'Name',
            value: `PublicSubnet-${region}-${index + 1}`,
          },
        ],
      });

      // Associate the Public Subnet with the route table
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetRouteTableAssoc-${region}-${index + 1}`, {
        subnetId: publicSubnet.ref,
        routeTableId: publicRouteTable.ref,
      });

      // Add public subnet to the array
      publicSubnets.push(publicSubnet);  // Ensure the subnet is added to the array
    });

// Create Security Group
    const cfnSecurityGroup = new ec2.CfnSecurityGroup(this, `CfnSecurityGroup-${region}`, {
      vpcId: vpc.ref,
      groupDescription: 'Allow HTTP and HTTPS traffic only',
      securityGroupIngress: [
        {
          ipProtocol: 'tcp',
          fromPort: 80,
          toPort: 80,
          cidrIp: '0.0.0.0/0',  // Allow inbound HTTP traffic from any IP
        },
        {
          ipProtocol: 'tcp',
          fromPort: 443,
          toPort: 443,
          cidrIp: '0.0.0.0/0',  // Allow inbound HTTPS traffic from any IP
        },
      ],
    });

    new cdk.CfnOutput(this, `SecurityGroupId-${region}`, {
      value: cfnSecurityGroup.ref,
      description: `Security Group ID in ${region}`,
    });

// ------------------------------------ Private

// Define configurations for Private Subnets
    const PrivateSubnetConfigs = [
      { availabilityZone: `${region}a`, cidrBlock: '10.0.2.0/24' },
      { availabilityZone: `${region}b`, cidrBlock: '10.0.5.0/24' },
    ];

// Create NAT Gateways in Public Subnets
    const natGateways: ec2.CfnNatGateway[] = [];
    publicSubnets.forEach((publicSubnet, index) => {
      const natGatewayEip = new ec2.CfnEIP(this, `NatGatewayEIP-${region}-${index + 1}`);

      const natGateway = new ec2.CfnNatGateway(this, `NatGateway-${region}-${index + 1}`, {
        subnetId: publicSubnet.ref,               // Attach to the public subnet
        allocationId: natGatewayEip.attrAllocationId,
        tags: [
          {
            key: 'Name',
            value: `PublicNatGateway-${region}-${index + 1}`,
          },
        ],
      });

      natGateways.push(natGateway);
    });

// Private Subnets
    const privateSubnets: ec2.CfnSubnet[] = PrivateSubnetConfigs.map((config, index) => {
      const privateSubnet = new ec2.CfnSubnet(this, `PrivateSubnet-${region}-${index + 1}`, {
        vpcId: vpc.ref,  // Use the VPC created earlier
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        tags: [
          {
            key: 'Name',
            value: `PrivateSubnet-${region}-${index + 1}`,
          },
        ],
      });

      // Route Table for Private Subnet
      const privateRouteTable = new ec2.CfnRouteTable(this, `PrivateRouteTable-${region}-${index + 1}`, {
        vpcId: vpc.ref,  // Use the VPC created earlier
        tags: [
          {
            key: 'Name',
            value: `PrivateRouteTable-${region}-${index + 1}_ToNAT`,
          },
        ],
      });

      // Route to NAT Gateway (round-robin distribution)
      new ec2.CfnRoute(this, `PrivateSubnetRouteTarget-${region}-${index + 1}`, {
        routeTableId: privateRouteTable.ref,
        destinationCidrBlock: '0.0.0.0/0',                         // Route all outbound traffic
        natGatewayId: natGateways[index % natGateways.length].ref, // Use NAT Gateway in round-robin
      });

      // Associate the Route Table with the Private Subnet
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetRouteTableAssoc-${region}-${index + 1}`, {
        subnetId: privateSubnet.ref,
        routeTableId: privateRouteTable.ref,
      });

      return privateSubnet; // Add the subnet to the array
    });

    // Optionally output the Private Subnet IDs
    privateSubnets.forEach((subnet, index) => {
      new cdk.CfnOutput(this, `PrivateSubnetIdOutput-${region}-${index + 1}`, {
        value: subnet.ref,
        description: `Private Subnet ID for region ${region}, Subnet ${index + 1}`,
      });
    });



  }
}