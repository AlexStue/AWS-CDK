import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { Construct } from 'constructs';
import * as elbv2_targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';


export class MyVpcAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    //const availabilityZones = ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'];

// ------------------------------------ Network
/*

cdk synth
cdk deploy
cdk destroy

Manual Stuff:
- VPC
- Security Group


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
    const PublicSubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.1.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.4.0/24' },
    ];

// 2.1 Public Subnet 1
    const publicSubnets: ec2.Subnet[] = [];  // To store created subnets
    PublicSubnetConfigs.forEach((config, index) => {
      const PublicSubnet = new ec2.Subnet(this, `PublicSubnet_${index + 1}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
        mapPublicIpOnLaunch: true
      });
      publicSubnets.push(PublicSubnet); // Store the subnet in the array for later use
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

// 2.3 Add a Route to the Internet Gateway in the Route Table
    new ec2.CfnRoute(this, 'PublicSubnetRoute', {
      routeTableId: publicRouteTable.ref,
      destinationCidrBlock: '0.0.0.0/0',  // Route for all traffic
      gatewayId: internetGateway.ref,     // Target is the Internet Gateway
    });

// 2.3 Associate the Route Table with each Public Subnet
    vpc.publicSubnets.forEach((subnet, index) => {
      new ec2.CfnSubnetRouteTableAssociation(this, `PublicSubnetRouteTableAssoc_${index + 1}`, {
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

// Define configurations for private subnets (availability zones and CIDR blocks)
    const PrivateSubnetConfigs = [
      { availabilityZone: 'eu-central-1a', cidrBlock: '10.0.2.0/24' },
      { availabilityZone: 'eu-central-1b', cidrBlock: '10.0.5.0/24' },
    ];

// 3.2 Create a NAT Gateway in each Public Subnet and allocate an Elastic IP
    // Define an array to hold the NAT Gateways for each public subnet
    const natGateways: ec2.CfnNatGateway[] = [];
    publicSubnets.forEach((publicSubnet, index) => {
      const natGatewayEip = new ec2.CfnEIP(this, `NatGatewayEIP_${index + 1}`);
      const natGateway = new ec2.CfnNatGateway(this, `NatGateway_${index + 1}`, {
        subnetId: publicSubnet.subnetId,
        allocationId: natGatewayEip.attrAllocationId,
      });
      natGateways.push(natGateway);  // Store each NAT Gateway
    });

// 3.1 Create Private Subnets and Route Tables, associating each with a NAT Gateway
    const privateSubnets: ec2.Subnet[] = [];
    PrivateSubnetConfigs.forEach((config, index) => {
      // Create Private Subnet
      const privateSubnet = new ec2.Subnet(this, `PrivateSubnet_${index + 1}`, {
        vpcId: vpc.vpcId,
        cidrBlock: config.cidrBlock,
        availabilityZone: config.availabilityZone,
      });
      privateSubnets.push(privateSubnet);

      // Create a Route Table for this Private Subnet
      const privateRouteTable = new ec2.CfnRouteTable(this, `PrivateRouteTable_${index + 1}`, {
        vpcId: vpc.vpcId,
      });

      // Add Route to the NAT Gateway in the Private Route Table
      new ec2.CfnRoute(this, `PrivateSubnetRoute_${index + 1}`, {
        routeTableId: privateRouteTable.ref,
        destinationCidrBlock: '0.0.0.0/0', // Route all outbound traffic
        natGatewayId: natGateways[index % natGateways.length].ref, // Use NAT Gateway in round-robin
      });

      // Associate Route Table with Private Subnet
      new ec2.CfnSubnetRouteTableAssociation(this, `PrivateSubnetRouteTableAssoc_${index + 1}`, {
        subnetId: privateSubnet.subnetId,
        routeTableId: privateRouteTable.ref,
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

    const instances: ec2.Instance[] = [];
    privateSubnets.forEach((privateSubnet, index) => {
      const instance = new ec2.Instance(this, `Instance${index + 1}`, {
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
      // Save instance in the array for later use
      instances.push(instance);
    });

// ------------------------------------ Loadbalancer

// Create an Application Load Balancer (ALB) in the public subnets
    const alb = new elbv2.ApplicationLoadBalancer(this, 'MyALB', {
      vpc,
      internetFacing: true,  // ALB is publicly accessible
      loadBalancerName: 'MyALB',  // Name of the ALB
    });

// Define a security group for the ALB to allow internal HTTP traffic
    const albSecurityGroup = new ec2.SecurityGroup(this, 'InternalALBSecurityGroup', {
      vpc,
      allowAllOutbound: true,
      description: 'Allow internal HTTP traffic to ALB',
    });

    // Allow inbound HTTP (port 80) traffic only from within the VPC CIDR range
    albSecurityGroup.addIngressRule(
      ec2.Peer.ipv4(vpc.vpcCidrBlock),  // Restrict access to within the VPC
      ec2.Port.tcp(80),
      'Allow HTTP traffic from within VPC'
    );

    // Attach the security group to the ALB
    alb.addSecurityGroup(albSecurityGroup);

// Create a Target Group for HTTP (for EC2 instances)
    const targetGroup = new elbv2.ApplicationTargetGroup(this, 'MyTargetGroup', {
      vpc,
      port: 80,  // Target port for instances
      protocol: elbv2.ApplicationProtocol.HTTP,  // Use HTTP protocol
      targetType: elbv2.TargetType.INSTANCE,
      healthCheck: {
        path: '/',  // Health check path
        interval: cdk.Duration.seconds(30),
      },
    });

    // Register each EC2 instance in the private subnets as a target
    instances.forEach((instance, index) => {
      targetGroup.addTarget(new elbv2_targets.InstanceIdTarget(instance.instanceId));
    });

// Add a listener on port 80 for the internal ALB
    const listener = alb.addListener('InternalListener', {
      port: 80,                       // Listening on port 80 for HTTP traffic
      defaultTargetGroups: [targetGroup],  // Route traffic to the target group
    });

  }
}