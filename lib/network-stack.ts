import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export class MyVpcAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    const availabilityZones = ['eu-central-1a', 'eu-central-1b', 'eu-central-1c'];

// ------------------------------------ Order
/*

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
    association: one Private Subnets x
  3.4 Security Group
    Inbound: (all)
    Outbound: (all)

4. EC2 Instances
    A.Linux
    t2.micro
    SSH Key ""
    Private Subnet x
    Security Group
    IAM for SSM

5. Loadbalancer


*/
// ------------------------------------ VPC

// VPC new 
    //const vpc = new ec2.Vpc(this, 'MyCustomVpc', {
    //  cidr: '10.0.0.0/16',
    //});

// VPC existing 
    const vpc = ec2.Vpc.fromLookup(this, 'MyExistingVpc', {
      vpcId: 'vpc-05d64cdbb3ad8727c', // Replace with your VPC ID
      region: 'eu-central-1', // Specify the region if needed
    });

// ------------------------------------ Public

// Internet-Gateway
const internetGateway = new ec2.CfnInternetGateway(this, 'MyInternetGateway');
new ec2.CfnVPCGatewayAttachment(this, 'AttachGateway', {
  vpcId: vpc.vpcId,
  internetGatewayId: internetGateway.ref,
});

// Public Subnet
const publicSubnet = new ec2.Subnet(this, 'MyPublicSubnet', {
  vpcId: vpc.vpcId,            // Verweise auf die VPC
  cidrBlock: '10.0.8.0/24',    // CIDR für das Subnetz
  availabilityZone: availabilityZones[0],  // Verfügbare Zone
  mapPublicIpOnLaunch: true,   // Öffentliche IPs für Instanzen
});

// NAT-Gateway
const eip = new ec2.CfnEIP(this, 'MyEIP');  // Elastic IP für das NAT Gateway
const natGateway = new ec2.CfnNatGateway(this, 'MyNatGateway', {
  subnetId: publicSubnet.subnetId,  // NAT Gateway im öffentlichen Subnetz
  allocationId: eip.ref,  // Weist die Elastic IP zu
});





// Private Subnet
    const privateSubnet = new ec2.Subnet(this, 'NewPrivateSubnet', {
      vpcId: vpc.vpcId,  // Link to the existing VPC
      cidrBlock: '10.0.6.0/24',  // Specify the CIDR block for the new private subnet
      availabilityZone: availabilityZones[0],  // Set the Availability Zone
    });



// ------------------------------------ Public




// Routing-Tabelle Private Subnet
    new ec2.CfnRoute(this, 'PrivateRouteToNat', {
      routeTableId: privateSubnet.node.findChild('RouteTable').ref,  // Routing-Tabelle des privaten Subnetzes
      destinationCidrBlock: '0.0.0.0/0',  // Routen für alle IPs
      natGatewayId: natGateway.ref,  // Verwendung des NAT Gateways
    });

// ------------------------------------ LB

// Erstelle eine Routing-Tabelle für das private Subnetz
const routeTable = new ec2.CfnRouteTable(this, 'PrivateRouteTable', {
  vpcId: vpc.vpcId,  // VPC zuordnen
});

// Füge eine Route zum NAT Gateway hinzu
new ec2.CfnRoute(this, 'PrivateRouteToNat', {
  routeTableId: routeTable.ref,  // Routing-Tabelle des privaten Subnetzes
  destinationCidrBlock: '0.0.0.0/0',  // Zielnetzwerk (alle IPs)
  natGatewayId: natGateway.ref,  // NAT Gateway für die Route
});

// Verknüpfe die Routing-Tabelle mit dem privaten Subnetz
new ec2.CfnSubnetRouteTableAssociation(this, 'PrivateSubnetRouteTableAssoc', {
  subnetId: privateSubnet.subnetId,
  routeTableId: routeTable.ref,
});


  }
}
