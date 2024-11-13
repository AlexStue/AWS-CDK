import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export class MyVpcAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const availabilityZones = ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'];

// ------------------------------------ Network
/*

cdk synth
cdk deploy
cdk destroy

1. VPC

2. Public
  2.1 Public Subnet
    Public IP
  2.2 Internet Gateway
  2.3 Route Table
    Route: 0.0.0.0/0
    Target: Internet Gateway
    association: all Public Subnets
  2.4 Security Group
    Inbound: (all)
    Outbound: (all)

3. Private
  3.1 Private Subnet
  3.2 NAT Gateway
    Subnet: Public Subnet
    Allocate Elastic IP
  3.3 Route Table
    Route: 0.0.0.0/0
    Target: NAT Gateway
    association: one Private Subnet x

4. EC2 Instances
    A.Linux
    t2.micro
    SSH Key ""
    Private Subnet x
    Security Group (all)
    IAM for SSM

5. Loadbalancer

*/
// ------------------------------------ VPC

// 1. VPC new
    //const vpc = new ec2.Vpc(this, 'MyCustomVpc', {
    //  cidr: '10.0.0.0/16',
    //});

// 1. VPC existing 
    const vpc = ec2.Vpc.fromLookup(this, 'MyExistingVpc', {
      vpcId: 'vpc-05d64cdbb3ad8727c', // Replace with your VPC ID
      region: 'eu-central-1', // Specify the region if needed
    });

// ------------------------------------ Public

    // Define availability zones and CIDR blocks for each private subnet
    const publicsubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.6.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.7.0/24' },
    ];

// 2.1 Public Subnet 1
    const publicSubnet = new ec2.Subnet(this, 'MyPublicSubnet', {
      vpcId: vpc.vpcId,            // Verweise auf die VPC
      cidrBlock: '10.0.8.0/24',    // CIDR für das Subnetz
      availabilityZone: availabilityZones[0],  // Verfügbare Zone
      mapPublicIpOnLaunch: true,   // Öffentliche IPs für Instanzen
    });

// 2.2 Internet-Gateway
    const internetGateway = new ec2.CfnInternetGateway(this, 'MyInternetGateway');
    new ec2.CfnVPCGatewayAttachment(this, 'AttachGateway', {
      vpcId: vpc.vpcId,
      internetGatewayId: internetGateway.ref,
    });

// 2.3 Create a Route Table for Public Subnets
    const publicRouteTable = new ec2.CfnRouteTable(this, 'PublicRouteTable', {
      vpcId: vpc.vpcId,
    });

// 2.3 Add a Route to the Internet Gateway in the Public Route Table
    new ec2.CfnRoute(this, 'PublicSubnetRoute', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',  // Route for all traffic
      gatewayId: internetGateway.ref,      // Target is the Internet Gateway
    });

// 2.3 Associate the Public Route Table with each Public Subnet - loop
    vpc.publicSubnets.forEach((subnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetRouteTableAssoc${index}`, {
        subnetId: subnet.subnetId,
        routeTableId: publicRouteTable.ref,
      });
    });

// 2.4 Define a Security Group that allows all inbound and outbound traffic
    const securityGroup = new ec2.SecurityGroup(this, 'AllowAllTrafficSG', {
      vpc,
      allowAllOutbound: true,  // Allows all outbound traffic by default
      description: 'Security group that allows all inbound and outbound traffic',
    });

// 2.4 Allow all inbound traffic
    securityGroup.addIngressRule(
      ec2.Peer.anyIpv4(),       // Allows any IPv4 address
      ec2.Port.allTraffic(),    // Allows all ports and protocols
      'Allow all inbound traffic'
    );

// ------------------------------------ Private

    // Define availability zones and CIDR blocks for each private subnet
    const privatesubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.6.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.7.0/24' },
    ];

// 3.1 Private Subnets
    // --- First loop: Create subnets ---
    const privateSubnets: ec2.Subnet[] = [];  // To store created subnets
    privatesubnetConfigs.forEach((config, index) => {
      const privateSubnet = new ec2.Subnet(this, `PrivateSubnet_${index + 1}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
      });
      // Store the subnet in the array for later use
      privateSubnets.push(privateSubnet);
    });

// 3.2 NAT Gateway 1
    // Allocate an Elastic IP for the NAT Gateway
    const natElasticIp = new ec2.CfnEIP(this, 'NatEip', {
      domain: 'vpc',
    });
    // Select a specific public subnet to place the NAT Gateway
    const publicSubnet1toNAT = vpc.publicSubnets[0];  // Using the first public subnet

    // Create the NAT Gateway in the selected public subnet with the Elastic IP
    const natGateway = new ec2.CfnNatGateway(this, 'NatGateway', {
      subnetId: publicSubnet1toNAT.subnetId,
      allocationId: natElasticIp.attrAllocationId,
    });

// 3.3 Route Table - loop
    // Create a route in each private subnet route table to use the NAT Gateway for outbound internet traffic
    vpc.privateSubnets.forEach((privateSubnet, index) => {
      const privateRouteTable = privateSubnet.routeTable;
      
      new ec2.CfnRoute(this, `PrivateSubnetRoute${index}`, {
        routeTableId: privateRouteTable.routeTableId,
        destinationCidrBlock: '0.0.0.0/0',  // Route for all traffic
        natGatewayId: natGateway.ref,       // Target the NAT Gateway
      });
    });

// ------------------------------------ Instances

    // Use an existing security group by its name or ID
    const securityGroup_x = ec2.SecurityGroup.fromSecurityGroupId(this, 'SecurityGroup', 'sec-1');

    // Define the existing IAM role
    const instanceRole_x = iam.Role.fromRoleArn(this, 'InstanceRole', 'arn:aws:iam::123456789012:role/role-1');

    // Define the AMI for Amazon Linux 2023
    const ami = new ec2.AmazonLinuxImage({
      generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2023,
    });

    // --- Second loop: Create EC2 instances ---
    privateSubnets.forEach((privateSubnet, index) => {
      // Create EC2 instance in the private subnet
      new ec2.Instance(this, `Instance${index + 1}`, {
        vpc,
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
        machineImage: ami,
        keyName: 'key-aws-1',  // SSH key name
        vpcSubnets: {
          subnets: [privateSubnet],  // Place the instance in this specific private subnet
        },
        securityGroup: securityGroup,
        role: instanceRole_x,
      });
    });

// ------------------------------------ Loadbalancer





  }
}