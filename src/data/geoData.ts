/**
 * KOSH INNOVATIONS — GEOGRAPHIC CASCADING MASTER DATA
 * Hierarchy: 1. Country -> 2. State / Province -> 3. District -> 4. City -> 5. Postal Code
 */

export interface GeoCity {
  cityName: string;
  postalCodes: string[];
}

export interface GeoDistrict {
  districtName: string;
  cities: GeoCity[];
}

export interface GeoState {
  stateName: string;
  stateCode?: string; // India GST State code e.g. '27', '33', '29'
  districts: GeoDistrict[];
}

export interface GeoCountry {
  countryCode: string; // ISO 2-letter e.g. 'IN', 'US', 'DE', 'AE', 'SG'
  countryName: string;
  states: GeoState[];
}

export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu & Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra & Nagar Haveli and Daman & Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman & Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const CASCADING_GEO_MASTERS: GeoCountry[] = [
  {
    countryCode: 'IN',
    countryName: 'India',
    states: [
      {
        stateName: 'Maharashtra',
        stateCode: '27',
        districts: [
          {
            districtName: 'Mumbai City',
            cities: [
              { cityName: 'Mumbai', postalCodes: ['400001', '400002', '400018', '400021'] },
              { cityName: 'Fort', postalCodes: ['400001'] },
              { cityName: 'Nariman Point', postalCodes: ['400021'] },
              { cityName: 'Worli', postalCodes: ['400018'] },
            ],
          },
          {
            districtName: 'Thane',
            cities: [
              { cityName: 'Thane', postalCodes: ['400601', '400602', '400604'] },
              { cityName: 'Navi Mumbai', postalCodes: ['400703', '400705', '400706'] },
              { cityName: 'Kalyan', postalCodes: ['421301', '421306'] },
              { cityName: 'Bhiwandi', postalCodes: ['421302'] },
            ],
          },
          {
            districtName: 'Pune',
            cities: [
              { cityName: 'Pune', postalCodes: ['411001', '411002', '411004', '411014'] },
              { cityName: 'Pimpri-Chinchwad', postalCodes: ['411018', '411019', '411033'] },
              { cityName: 'Chakan', postalCodes: ['410501'] },
              { cityName: 'Talegaon Dabhade', postalCodes: ['410506'] },
            ],
          },
          {
            districtName: 'Nashik',
            cities: [
              { cityName: 'Nashik', postalCodes: ['422001', '422003'] },
              { cityName: 'Sinnar', postalCodes: ['422103'] },
              { cityName: 'Satpur', postalCodes: ['422007'] },
            ],
          },
          {
            districtName: 'Aurangabad (Chhatrapati Sambhajinagar)',
            cities: [
              { cityName: 'Aurangabad', postalCodes: ['431001', '431005'] },
              { cityName: 'Waluj', postalCodes: ['431136'] },
            ],
          },
        ],
      },
      {
        stateName: 'Tamil Nadu',
        stateCode: '33',
        districts: [
          {
            districtName: 'Chennai',
            cities: [
              { cityName: 'Chennai', postalCodes: ['600001', '600002', '600010'] },
              { cityName: 'Guindy', postalCodes: ['600032'] },
              { cityName: 'Ambattur', postalCodes: ['600058'] },
              { cityName: 'Sriperumbudur', postalCodes: ['602105'] },
            ],
          },
          {
            districtName: 'Kanchipuram',
            cities: [
              { cityName: 'Kanchipuram', postalCodes: ['631501'] },
              { cityName: 'Oragadam', postalCodes: ['602105'] },
              { cityName: 'Maraimalai Nagar', postalCodes: ['603209'] },
            ],
          },
          {
            districtName: 'Krishnagiri',
            cities: [
              { cityName: 'Hosur', postalCodes: ['635109', '635126'] },
              { cityName: 'Krishnagiri', postalCodes: ['635001'] },
            ],
          },
          {
            districtName: 'Coimbatore',
            cities: [
              { cityName: 'Coimbatore', postalCodes: ['641001', '641006'] },
              { cityName: 'Peelamedu', postalCodes: ['641004'] },
            ],
          },
        ],
      },
      {
        stateName: 'Puducherry',
        stateCode: '34',
        districts: [
          {
            districtName: 'Puducherry',
            cities: [
              { cityName: 'Puducherry', postalCodes: ['605001', '605002'] },
              { cityName: 'Oulgaret', postalCodes: ['605009'] },
              { cityName: 'Villianur', postalCodes: ['605110'] },
              { cityName: 'Sedarapet Industrial Area', postalCodes: ['605111'] },
            ],
          },
        ],
      },
      {
        stateName: 'Karnataka',
        stateCode: '29',
        districts: [
          {
            districtName: 'Bengaluru Urban',
            cities: [
              { cityName: 'Bengaluru', postalCodes: ['560001', '560002', '560025'] },
              { cityName: 'Whitefield', postalCodes: ['560066'] },
              { cityName: 'Peenya Industrial Estate', postalCodes: ['560058'] },
              { cityName: 'Electronic City', postalCodes: ['560100'] },
            ],
          },
          {
            districtName: 'Dakshina Kannada',
            cities: [
              { cityName: 'Mangaluru', postalCodes: ['575001', '575003'] },
              { cityName: 'Surathkal', postalCodes: ['575014'] },
            ],
          },
        ],
      },
      {
        stateName: 'Gujarat',
        stateCode: '24',
        districts: [
          {
            districtName: 'Ahmedabad',
            cities: [
              { cityName: 'Ahmedabad', postalCodes: ['380001', '380009'] },
              { cityName: 'Sanand', postalCodes: ['382110'] },
              { cityName: 'Changodar', postalCodes: ['382213'] },
            ],
          },
          {
            districtName: 'Vadodara',
            cities: [
              { cityName: 'Vadodara', postalCodes: ['390001', '390007'] },
              { cityName: 'Halol GIDC', postalCodes: ['389350'] },
            ],
          },
        ],
      },
      {
        stateName: 'Delhi',
        stateCode: '07',
        districts: [
          {
            districtName: 'New Delhi',
            cities: [
              { cityName: 'New Delhi', postalCodes: ['110001', '110002'] },
              { cityName: 'Connaught Place', postalCodes: ['110001'] },
            ],
          },
          {
            districtName: 'South Delhi',
            cities: [
              { cityName: 'Okhla Industrial Area', postalCodes: ['110020'] },
              { cityName: 'Hauz Khas', postalCodes: ['110016'] },
            ],
          },
        ],
      },
    ],
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    states: [
      {
        stateName: 'California',
        districts: [
          {
            districtName: 'Santa Clara County',
            cities: [
              { cityName: 'San Jose', postalCodes: ['95110', '95112'] },
              { cityName: 'Palo Alto', postalCodes: ['94301', '94303'] },
              { cityName: 'Sunnyvale', postalCodes: ['94085', '94086'] },
            ],
          },
          {
            districtName: 'Los Angeles County',
            cities: [
              { cityName: 'Los Angeles', postalCodes: ['90001', '90012'] },
              { cityName: 'Torrance', postalCodes: ['90501', '90503'] },
            ],
          },
        ],
      },
      {
        stateName: 'Michigan',
        districts: [
          {
            districtName: 'Wayne County',
            cities: [
              { cityName: 'Detroit', postalCodes: ['48201', '48226'] },
              { cityName: 'Dearborn', postalCodes: ['48120', '48126'] },
            ],
          },
        ],
      },
    ],
  },
  {
    countryCode: 'DE',
    countryName: 'Germany',
    states: [
      {
        stateName: 'Bavaria',
        districts: [
          {
            districtName: 'Upper Bavaria',
            cities: [
              { cityName: 'Munich', postalCodes: ['80331', '80333'] },
              { cityName: 'Ingolstadt', postalCodes: ['85049', '85055'] },
            ],
          },
        ],
      },
    ],
  },
  {
    countryCode: 'AE',
    countryName: 'United Arab Emirates',
    states: [
      {
        stateName: 'Dubai',
        districts: [
          {
            districtName: 'Jebel Ali Free Zone',
            cities: [
              { cityName: 'Dubai JAFZA', postalCodes: ['00000'] },
            ],
          },
        ],
      },
    ],
  },
  {
    countryCode: 'SG',
    countryName: 'Singapore',
    states: [
      {
        stateName: 'Central Region',
        districts: [
          {
            districtName: 'Jurong Industrial Estate',
            cities: [
              { cityName: 'Singapore Jurong', postalCodes: ['609601'] },
            ],
          },
        ],
      },
    ],
  },
];

export const SAP_B1_PROPERTIES: string[] = [
  'VIP Account',
  'Key OEM Customer',
  'ISO Certified Supplier',
  'Strategic Partner',
  'MSME Registered Enterprise',
  'Credit Guarded Account',
  'Export Authorized Partner',
  'High Priority Delivery',
  'Automotive Tier-1 Verified',
  'Direct Billable Account',
  'Advance Payment Required',
  'Non-Standard Payment Terms',
  'Vendor Managed Inventory (VMI)',
  'Consignment Stock Allowed',
  'Subcontract Processing Vendor',
  'Quality Rating A+',
];
