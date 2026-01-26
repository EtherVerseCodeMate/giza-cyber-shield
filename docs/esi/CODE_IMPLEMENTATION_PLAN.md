# ESI Features - Code Implementation Plan

**Purpose:** Technical roadmap for implementing ESI-required features in the Giza Cyber Shield codebase

**Status:** Planning Phase
**Target Completion:** Q3 2026 (aligned with GSA Schedule award)

---

## Implementation Priority Matrix

### P0 - Critical (Must Have for GSA Schedule)
1. Complete NIST 800-171 implementation (110 controls)
2. Enterprise licensing system
3. GSA Schedule compliance validator
4. System Security Plan (SSP) generator

### P1 - High (Must Have for ESI Listing)
5. RMF automation (6-step process)
6. ESI multi-tenant architecture
7. ESI Government Portal
8. TCO calculator

### P2 - Medium (Nice to Have for ESI)
9. FedRAMP+ compliance module
10. ESI ordering guide generator
11. Continuous monitoring dashboards

---

## New Package Structure

```
/pkg/
├── compliance/
│   ├── nist80171/          # NEW: Complete NIST 800-171 (P0)
│   │   ├── access_control.go
│   │   ├── audit_accountability.go
│   │   ├── awareness_training.go
│   │   ├── configuration_mgmt.go
│   │   ├── identification_auth.go
│   │   ├── incident_response.go
│   │   ├── maintenance.go
│   │   ├── media_protection.go
│   │   ├── personnel_security.go
│   │   ├── physical_protection.go
│   │   ├── risk_assessment.go
│   │   ├── security_assessment.go
│   │   ├── sys_comms_protection.go
│   │   ├── sys_info_integrity.go
│   │   ├── mapper.go           # CMMC ← → NIST 800-171 ← → STIG
│   │   └── evidence_collector.go
│   │
│   ├── rmf/                # NEW: Risk Management Framework (P1)
│   │   ├── categorization.go   # RMF Step 1: FIPS 199
│   │   ├── selection.go        # RMF Step 2: Control selection
│   │   ├── implementation.go   # RMF Step 3: Implement controls
│   │   ├── assessment.go       # RMF Step 4: Assess controls
│   │   ├── authorization.go    # RMF Step 5: Authorize system
│   │   ├── monitoring.go       # RMF Step 6: Continuous monitoring
│   │   └── artifacts/
│   │       ├── ssp_generator.go
│   │       ├── sap_generator.go
│   │       ├── sar_generator.go
│   │       └── poam_generator.go
│   │
│   ├── fedramp/            # NEW: FedRAMP+ (P2)
│   │   ├── impact_level.go
│   │   ├── cloud_srg.go
│   │   ├── baseline.go
│   │   ├── dod_enhancements.go
│   │   └── continuous_monitoring.go
│   │
│   └── gsa/                # NEW: GSA Schedule (P0)
│       ├── schedule70_validator.go
│       ├── pricing_structure.go
│       ├── contract_generator.go
│       └── sin_manager.go
│
├── esi/                    # NEW: ESI-specific features
│   ├── tenant/             # P1: Multi-tenant management
│   │   ├── manager.go
│   │   ├── isolation.go
│   │   └── types.go
│   │
│   ├── licensing/          # P0: Enterprise licensing
│   │   ├── enterprise_agreement.go
│   │   ├── org_wide_licensing.go
│   │   ├── authorized_users.go
│   │   └── usage_tracking.go
│   │
│   ├── tco/                # P1: Total Cost of Ownership
│   │   ├── calculator.go
│   │   ├── cost_categories.go
│   │   ├── avoidance_metrics.go
│   │   └── comparison.go
│   │
│   ├── monitoring/         # P1: ESI continuous monitoring
│   │   ├── continuous_compliance.go
│   │   ├── dod_reporting.go
│   │   ├── incident_reporting.go
│   │   └── metrics/
│   │       ├── stig_compliance_rate.go
│   │       ├── cmmc_posture.go
│   │       ├── ato_status.go
│   │       └── vulnerability_metrics.go
│   │
│   └── ordering/           # P2: Ordering guide generation
│       ├── guide_generator.go
│       ├── catalog.go
│       └── templates/
│
└── crypto/
    └── pqc/                # EXISTING: Enhance for ESI
        ├── dilithium.go    # Already implemented ✅
        ├── kyber.go        # Already implemented ✅
        └── attestation.go  # NEW: ESI-specific attestation
```

---

## Implementation Details by Priority

### P0-1: Complete NIST 800-171 (Critical)

**Goal:** Implement all 110 NIST 800-171 Rev 2 controls to achieve DFARS compliance

**Current State:**
- Only 4 controls implemented in `/pkg/stig/cmmc.go`
- Need 106 additional controls across 14 families

**New Files to Create:**

#### `/pkg/compliance/nist80171/access_control.go`
```go
package nist80171

import (
    "github.com/yourusername/giza-cyber-shield/pkg/scanner"
)

// AC-1: Access Control Policy and Procedures
type AC_1 struct {
    PolicyExists      bool
    PolicyReviewed    time.Time
    ProceduresExist   bool
    Compliant         bool
}

// AC-2: Account Management
type AC_2 struct {
    AccountTypesIdentified        bool
    AccountsAuthorized           bool
    ConditionsForGroupMembership bool
    PrivilegedAccountsMonitored  bool
    Compliant                    bool
}

// ... implement all 22 AC controls

func ValidateAccessControl(system *scanner.SystemInventory) ([]ACResult, error) {
    results := []ACResult{}

    // AC-1: Check for access control policy
    ac1 := ValidateAC1(system)
    results = append(results, ac1)

    // AC-2: Validate account management
    ac2 := ValidateAC2(system)
    results = append(results, ac2)

    // ... validate all AC controls

    return results, nil
}
```

**Effort Estimate:** 6-8 weeks (2 engineers)
**Testing:** Unit tests for each control family
**Documentation:** Mapping to STIG and CMMC controls

---

### P0-2: Enterprise Licensing System (Critical)

**Goal:** Support ESI Enterprise Software Agreement (ESA) licensing models

**New Files to Create:**

#### `/pkg/esi/licensing/enterprise_agreement.go`
```go
package licensing

import (
    "time"
)

type TenantType string

const (
    TenantTypeArmy       TenantType = "army"
    TenantTypeNavy       TenantType = "navy"
    TenantTypeAirForce   TenantType = "airforce"
    TenantTypeMarines    TenantType = "marines"
    TenantTypeSpaceForce TenantType = "spaceforce"
    TenantTypeAgency     TenantType = "agency"
)

type LicenseModel string

const (
    LicenseModelOrgWide     LicenseModel = "org-wide"
    LicenseModelNamedUser   LicenseModel = "named-user"
    LicenseModelConcurrent  LicenseModel = "concurrent"
    LicenseModelConsumption LicenseModel = "consumption"
)

type EnterpriseAgreement struct {
    ID                     string
    ESANumber              string        // DoD ESA contract number
    GSAContractNumber      string        // GSA Schedule number
    DoDAgreementNumber     string        // DoD-specific agreement number

    // Tenant Information
    TenantID               string
    TenantName             string
    TenantType             TenantType
    AuthorizedComponents   []string      // ["Army", "Navy", etc.]

    // Licensing
    LicenseModel           LicenseModel
    MaxUsers               int           // -1 for unlimited
    MaxFacilities          int           // -1 for unlimited
    MaxSystems             int           // -1 for unlimited

    // Pricing
    AnnualValue            float64
    VolumeDiscountTier     int
    MultiYearDiscount      float64

    // Contract Terms
    StartDate              time.Time
    EndDate                time.Time
    AutoRenewal            bool
    NoticeToTerminate      int           // Days notice required

    // Compliance
    ImpactLevel            string        // IL2, IL4, IL5, IL6
    DataResidency          string        // CONUS, OCONUS
    FedRAMPAuthorized      bool
    NIST800171Compliant    bool

    // Management
    SinglePOC              Contact
    ContractAdministrator  Contact
    TechnicalPOC           Contact

    CreatedAt              time.Time
    UpdatedAt              time.Time
}

type Contact struct {
    Name        string
    Title       string
    Email       string
    Phone       string
    Organization string
}

// ValidateESICompliance checks if ESA meets DoD ESI requirements
func (e *EnterpriseAgreement) ValidateESICompliance() []ComplianceIssue {
    issues := []ComplianceIssue{}

    // Must have ESA number (after ESI award)
    if e.ESANumber == "" {
        issues = append(issues, ComplianceIssue{
            Severity: "HIGH",
            Message:  "ESA Number is required for DoD ESI listing",
        })
    }

    // Must have GSA Schedule contract
    if e.GSAContractNumber == "" {
        issues = append(issues, ComplianceIssue{
            Severity: "CRITICAL",
            Message:  "GSA Schedule contract is prerequisite for ESI",
        })
    }

    // Must have Single Point of Contact
    if e.SinglePOC.Email == "" {
        issues = append(issues, ComplianceIssue{
            Severity: "HIGH",
            Message:  "Single POC is required for ESA",
        })
    }

    // Must have authorized DoD components
    if len(e.AuthorizedComponents) == 0 {
        issues = append(issues, ComplianceIssue{
            Severity: "HIGH",
            Message:  "Must specify authorized DoD components",
        })
    }

    return issues
}

// CalculateEffectivePrice computes final price with all discounts
func (e *EnterpriseAgreement) CalculateEffectivePrice() float64 {
    basePrice := e.AnnualValue

    // Apply volume discount
    volumeDiscount := GetVolumeDiscount(e.VolumeDiscountTier)
    basePrice *= (1.0 - volumeDiscount)

    // Apply multi-year discount
    basePrice *= (1.0 - e.MultiYearDiscount)

    return basePrice
}

func GetVolumeDiscount(tier int) float64 {
    switch tier {
    case 1: return 0.00  // 1-10 facilities
    case 2: return 0.10  // 11-50 facilities
    case 3: return 0.15  // 51-200 facilities
    case 4: return 0.20  // 201+ facilities
    default: return 0.00
    }
}
```

**Effort Estimate:** 3-4 weeks
**Integration:** Extend existing `/pkg/licensing/` module
**Testing:** License validation, usage tracking, billing calculations

---

### P0-3: GSA Schedule Validator (Critical)

**Goal:** Automated validation of GSA Schedule compliance requirements

#### `/pkg/compliance/gsa/schedule70_validator.go`
```go
package gsa

import (
    "fmt"
    "time"
)

type Schedule70Requirement string

const (
    Req_SAM_Registration     Schedule70Requirement = "SAM_REGISTRATION"
    Req_CAGE_Code            Schedule70Requirement = "CAGE_CODE"
    Req_Financial_Statements Schedule70Requirement = "FINANCIAL_STATEMENTS"
    Req_Commercial_Sales     Schedule70Requirement = "COMMERCIAL_SALES"
    Req_Pricing_Structure    Schedule70Requirement = "PRICING_STRUCTURE"
    Req_NIST_800171         Schedule70Requirement = "NIST_800171"
    Req_Security_Documentation Schedule70Requirement = "SECURITY_DOCS"
    Req_Section_508         Schedule70Requirement = "SECTION_508"
)

type Schedule70Compliance struct {
    Requirements map[Schedule70Requirement]RequirementStatus
    OverallStatus string  // "READY", "NOT_READY", "PARTIAL"
    Issues        []ComplianceIssue
    LastChecked   time.Time
}

type RequirementStatus struct {
    Met          bool
    Evidence     string
    LastVerified time.Time
    Notes        string
}

type ComplianceIssue struct {
    Severity    string  // "CRITICAL", "HIGH", "MEDIUM", "LOW"
    Requirement Schedule70Requirement
    Message     string
    Remediation string
}

// ValidateSchedule70Readiness checks all GSA Schedule 70 requirements
func ValidateSchedule70Readiness() (*Schedule70Compliance, error) {
    compliance := &Schedule70Compliance{
        Requirements: make(map[Schedule70Requirement]RequirementStatus),
        Issues:       []ComplianceIssue{},
        LastChecked:  time.Now(),
    }

    // Check SAM registration
    samStatus := CheckSAMRegistration()
    compliance.Requirements[Req_SAM_Registration] = samStatus
    if !samStatus.Met {
        compliance.Issues = append(compliance.Issues, ComplianceIssue{
            Severity:    "CRITICAL",
            Requirement: Req_SAM_Registration,
            Message:     "Not registered in SAM.gov",
            Remediation: "Register at https://sam.gov - takes 7-10 business days",
        })
    }

    // Check CAGE code
    cageStatus := CheckCAGECode()
    compliance.Requirements[Req_CAGE_Code] = cageStatus

    // Check NIST 800-171 compliance
    nistStatus := CheckNIST800171Compliance()
    compliance.Requirements[Req_NIST_800171] = nistStatus
    if !nistStatus.Met {
        compliance.Issues = append(compliance.Issues, ComplianceIssue{
            Severity:    "CRITICAL",
            Requirement: Req_NIST_800171,
            Message:     "NIST 800-171 compliance not complete",
            Remediation: "Implement all 110 controls in /pkg/compliance/nist80171/",
        })
    }

    // ... check all requirements

    // Determine overall status
    compliance.OverallStatus = DetermineOverallStatus(compliance)

    return compliance, nil
}

func DetermineOverallStatus(c *Schedule70Compliance) string {
    critical := 0
    total := len(c.Requirements)
    met := 0

    for _, status := range c.Requirements {
        if status.Met {
            met++
        }
    }

    for _, issue := range c.Issues {
        if issue.Severity == "CRITICAL" {
            critical++
        }
    }

    if critical > 0 {
        return "NOT_READY"
    }
    if met == total {
        return "READY"
    }
    return "PARTIAL"
}
```

**Effort Estimate:** 2-3 weeks
**Output:** Automated GSA Schedule readiness report
**Integration:** CI/CD pipeline check

---

### P1-1: RMF Automation (High Priority)

**Goal:** Automate the 6-step Risk Management Framework process

#### `/pkg/compliance/rmf/categorization.go`
```go
package rmf

import (
    "fmt"
)

// RMF Step 1: Categorize the System (FIPS 199)

type SecurityCategory string

const (
    CategoryLow      SecurityCategory = "LOW"
    CategoryModerate SecurityCategory = "MODERATE"
    CategoryHigh     SecurityCategory = "HIGH"
)

type SecurityObjective struct {
    Confidentiality SecurityCategory
    Integrity       SecurityCategory
    Availability    SecurityCategory
}

type SystemCategorization struct {
    SystemName         string
    SystemDescription  string
    SecurityObjectives SecurityObjective
    OverallCategory    SecurityCategory
    Justification      string
    CategorizedBy      string
    CategorizedDate    time.Time
}

// CategorizeSystem performs FIPS 199 categorization
func CategorizeSystem(systemInfo SystemInfo) (*SystemCategorization, error) {
    cat := &SystemCategorization{
        SystemName:        systemInfo.Name,
        SystemDescription: systemInfo.Description,
        CategorizedDate:   time.Now(),
    }

    // Determine Confidentiality impact
    cat.SecurityObjectives.Confidentiality = DetermineConfidentialityImpact(systemInfo)

    // Determine Integrity impact
    cat.SecurityObjectives.Integrity = DetermineIntegrityImpact(systemInfo)

    // Determine Availability impact
    cat.SecurityObjectives.Availability = DetermineAvailabilityImpact(systemInfo)

    // Overall category is the HIGH-WATER MARK
    cat.OverallCategory = DetermineOverallCategory(cat.SecurityObjectives)

    cat.Justification = GenerateJustification(cat)

    return cat, nil
}

func DetermineOverallCategory(obj SecurityObjective) SecurityCategory {
    if obj.Confidentiality == CategoryHigh ||
       obj.Integrity == CategoryHigh ||
       obj.Availability == CategoryHigh {
        return CategoryHigh
    }
    if obj.Confidentiality == CategoryModerate ||
       obj.Integrity == CategoryModerate ||
       obj.Availability == CategoryModerate {
        return CategoryModerate
    }
    return CategoryLow
}
```

**Effort Estimate:** 6-8 weeks (full RMF implementation)
**Output:** Complete ATO package (SSP, SAP, SAR, POAM)
**Market Value:** $100K-$200K per ATO project

---

### P1-2: Multi-Tenant Architecture (High Priority)

**Goal:** Support DoD component-wide and enterprise-wide deployments

#### `/pkg/esi/tenant/manager.go`
```go
package tenant

import (
    "context"
    "fmt"
    "github.com/yourusername/giza-cyber-shield/pkg/esi/licensing"
)

type TenantManager struct {
    db             *Database
    encryptionKey  []byte
}

type Tenant struct {
    ID                  string
    Name                string
    Type                licensing.TenantType
    ESANumber           string

    // Security
    ImpactLevel         string
    DataResidency       string
    EncryptionKeyID     string       // Per-tenant Kyber-1024 key

    // Licensing
    LicensePool         licensing.EnterpriseAgreement
    AuthorizedUsers     []User

    // Compliance
    ComplianceLevel     string       // CMMC Level 1/2/3
    RequiredSTIGs       []string     // Applicable STIGs
    RequiredControls    []string     // NIST 800-53 controls

    CreatedAt           time.Time
    UpdatedAt           time.Time
}

// CreateTenant provisions a new DoD component tenant
func (tm *TenantManager) CreateTenant(ctx context.Context, req CreateTenantRequest) (*Tenant, error) {
    // Validate ESA authorization
    if err := tm.ValidateESAAuthorization(req.ESANumber, req.TenantType); err != nil {
        return nil, fmt.Errorf("ESA authorization failed: %w", err)
    }

    // Generate per-tenant encryption key (Kyber-1024)
    encKey, err := tm.GenerateTenantEncryptionKey()
    if err != nil {
        return nil, fmt.Errorf("encryption key generation failed: %w", err)
    }

    tenant := &Tenant{
        ID:              GenerateUUID(),
        Name:            req.Name,
        Type:            req.TenantType,
        ESANumber:       req.ESANumber,
        ImpactLevel:     req.ImpactLevel,
        EncryptionKeyID: encKey.ID,
        CreatedAt:       time.Now(),
        UpdatedAt:       time.Now(),
    }

    // Configure Row-Level Security (RLS) in database
    if err := tm.ConfigureRLS(tenant); err != nil {
        return nil, fmt.Errorf("RLS configuration failed: %w", err)
    }

    // Set up network isolation
    if err := tm.ConfigureNetworkIsolation(tenant); err != nil {
        return nil, fmt.Errorf("network isolation failed: %w", err)
    }

    return tenant, nil
}

// EnforceIsolation ensures complete data isolation between tenants
func (tm *TenantManager) EnforceIsolation(tenant *Tenant) error {
    // 1. Database-level isolation (RLS)
    // 2. Network-level isolation (VPC/VLAN)
    // 3. Encryption-level isolation (per-tenant keys)
    // 4. API-level isolation (tenant context validation)
    return nil
}
```

**Effort Estimate:** 6-8 weeks
**Critical Path:** Required for DoD component-wide deployments
**Testing:** Tenant isolation validation, cross-tenant leak testing

---

## Frontend Enhancements for ESI

### New React Components Needed

```
/src/pages/esi/
├── government-portal.tsx        # ESI Government Portal landing
├── contract-dashboard.tsx       # View ESA contract details
├── license-management.tsx       # Manage enterprise licenses
├── usage-analytics.tsx          # DoD-wide usage visibility
├── ordering.tsx                 # Streamlined ordering interface
└── tco-calculator.tsx           # Total Cost of Ownership calculator

/src/components/esi/
├── ESADashboard.tsx             # Enterprise agreement overview
├── TenantSelector.tsx           # Switch between DoD components
├── ComplianceReporting.tsx      # DoD-wide compliance reports
└── OrderingWorkflow.tsx         # Step-by-step ordering UI
```

#### Example: `/src/pages/esi/tco-calculator.tsx`
```typescript
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';

interface TCOInputs {
  numFacilities: number;
  numSystems: number;
  contractLength: number;  // years
  currentComplianceCost: number;
}

interface TCOResults {
  traditionalCost: number;
  souhimbouCost: number;
  costAvoidance: number;
  percentSavings: number;
}

export default function TCOCalculator() {
  const [inputs, setInputs] = useState<TCOInputs>({
    numFacilities: 10,
    numSystems: 100,
    contractLength: 3,
    currentComplianceCost: 0,
  });

  const calculateTCO = (): TCOResults => {
    // Traditional compliance costs
    const cmmcConsultant = 200000;
    const c3paoAssessment = 50000 * inputs.numFacilities;
    const fteLaborPerYear = 150000 * 2;  // 2 FTEs
    const stigImplementation = 50000 * inputs.numFacilities;
    const rmfATO = 100000 * inputs.numSystems;
    const ongoingMonitoring = 100000 * inputs.contractLength;

    const traditionalTotal =
      cmmcConsultant +
      c3paoAssessment +
      (fteLaborPerYear * inputs.contractLength) +
      stigImplementation +
      rmfATO +
      ongoingMonitoring;

    // SouHimBou AI costs
    const volumeTier = getVolumeTier(inputs.numFacilities);
    const pricePerFacility = getPriceForTier(volumeTier);
    const multiYearDiscount = inputs.contractLength >= 3 ? 0.05 : 0;

    const platformCost =
      inputs.numFacilities *
      pricePerFacility *
      inputs.contractLength *
      (1 - multiYearDiscount);

    const reducedFTE = 75000 * inputs.contractLength;  // 0.5 FTE
    const implementation = 50000;

    const souhimbouTotal = platformCost + reducedFTE + implementation;

    return {
      traditionalCost: traditionalTotal,
      souhimbouCost: souhimbouTotal,
      costAvoidance: traditionalTotal - souhimbouTotal,
      percentSavings: ((traditionalTotal - souhimbouTotal) / traditionalTotal) * 100,
    };
  };

  const results = calculateTCO();

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader>
          <CardTitle>DoD Total Cost of Ownership Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Input sliders */}
          <div className="space-y-6">
            <div>
              <label>Number of Facilities: {inputs.numFacilities}</label>
              <Slider
                value={[inputs.numFacilities]}
                onValueChange={(val) => setInputs({...inputs, numFacilities: val[0]})}
                min={1}
                max={500}
                step={1}
              />
            </div>

            {/* More sliders... */}
          </div>

          {/* Results display */}
          <div className="mt-8 grid grid-cols-2 gap-4">
            <Card className="bg-red-50">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold text-red-700">
                  Traditional Compliance
                </h3>
                <p className="text-4xl font-bold mt-2">
                  ${results.traditionalCost.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Over {inputs.contractLength} years
                </p>
              </CardContent>
            </Card>

            <Card className="bg-green-50">
              <CardContent className="pt-6">
                <h3 className="text-2xl font-bold text-green-700">
                  SouHimBou AI Automated
                </h3>
                <p className="text-4xl font-bold mt-2">
                  ${results.souhimbouCost.toLocaleString()}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  Over {inputs.contractLength} years
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4 bg-blue-50 border-blue-300">
            <CardContent className="pt-6">
              <h3 className="text-3xl font-bold text-blue-700">
                Cost Avoidance: ${results.costAvoidance.toLocaleString()}
              </h3>
              <p className="text-xl text-blue-600 mt-2">
                {results.percentSavings.toFixed(1)}% savings vs. traditional compliance
              </p>
            </CardContent>
          </Card>

          <Button className="mt-6 w-full" size="lg">
            Request Government Quote
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function getVolumeTier(facilities: number): number {
  if (facilities <= 10) return 1;
  if (facilities <= 50) return 2;
  if (facilities <= 200) return 3;
  return 4;
}

function getPriceForTier(tier: number): number {
  switch (tier) {
    case 1: return 150000;
    case 2: return 135000;
    case 3: return 127500;
    case 4: return 120000;
    default: return 150000;
  }
}
```

**Effort Estimate:** 4-5 weeks (all ESI frontend components)
**Priority:** P1 (required for ESI Government Portal)

---

## Database Schema Changes

### New Tables for ESI

```sql
-- Enterprise Agreements (ESA contracts)
CREATE TABLE esi_enterprise_agreements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    esa_number VARCHAR(50) UNIQUE NOT NULL,
    gsa_contract_number VARCHAR(50) NOT NULL,
    dod_agreement_number VARCHAR(50),

    tenant_id UUID REFERENCES tenants(id),
    tenant_name VARCHAR(255) NOT NULL,
    tenant_type VARCHAR(50) NOT NULL,
    authorized_components TEXT[],

    license_model VARCHAR(50) NOT NULL,
    max_users INTEGER,
    max_facilities INTEGER,
    max_systems INTEGER,

    annual_value DECIMAL(12,2) NOT NULL,
    volume_discount_tier INTEGER,
    multi_year_discount DECIMAL(5,4),

    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    auto_renewal BOOLEAN DEFAULT true,

    impact_level VARCHAR(10),
    data_residency VARCHAR(20),
    fedramp_authorized BOOLEAN DEFAULT false,
    nist_800171_compliant BOOLEAN DEFAULT false,

    single_poc_name VARCHAR(255),
    single_poc_email VARCHAR(255),
    single_poc_phone VARCHAR(50),

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Multi-tenant isolation
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    esa_number VARCHAR(50) REFERENCES esi_enterprise_agreements(esa_number),

    impact_level VARCHAR(10),
    data_residency VARCHAR(20),
    encryption_key_id VARCHAR(255) NOT NULL,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Row-Level Security (RLS) policies
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
    USING (id = current_setting('app.current_tenant_id')::UUID);

-- Usage tracking for ESI reporting
CREATE TABLE esi_usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    metric_date DATE NOT NULL,

    systems_protected INTEGER,
    stig_validations_run INTEGER,
    cmmc_assessments INTEGER,
    ato_packages_generated INTEGER,
    compliance_score DECIMAL(5,2),

    created_at TIMESTAMP DEFAULT NOW()
);

-- GSA Schedule compliance tracking
CREATE TABLE gsa_schedule_compliance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requirement VARCHAR(100) NOT NULL,
    met BOOLEAN DEFAULT false,
    evidence TEXT,
    last_verified TIMESTAMP,
    notes TEXT,

    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Migration Scripts:** Create Alembic/Flyway migrations
**Testing:** Database isolation tests critical for multi-tenancy

---

## Testing Strategy

### Unit Tests
- [ ] All NIST 800-171 control validation functions
- [ ] Enterprise licensing calculations
- [ ] RMF artifact generation
- [ ] Tenant isolation logic

### Integration Tests
- [ ] End-to-end CMMC → STIG → NIST 800-171 mapping
- [ ] Multi-tenant data isolation
- [ ] ESI Government Portal workflows
- [ ] TCO calculator with real pricing

### Security Tests
- [ ] Tenant cross-contamination tests
- [ ] Privilege escalation tests
- [ ] API authorization tests
- [ ] Encryption key isolation

### Compliance Tests
- [ ] GSA Schedule requirement validation
- [ ] NIST 800-171 full control coverage
- [ ] RMF package completeness
- [ ] ESI ordering guide accuracy

---

## Documentation Requirements

### Technical Documentation
- [ ] API documentation (OpenAPI 3.0 spec)
- [ ] Architecture diagrams (multi-tenant design)
- [ ] Database schema documentation
- [ ] Integration guides (eMASS, STIG Viewer, etc.)

### Compliance Documentation
- [ ] System Security Plan (SSP) template
- [ ] NIST 800-171 Self-Attestation
- [ ] GSA Schedule compliance matrix
- [ ] ESI vendor toolkit responses

### User Documentation
- [ ] Administrator guide
- [ ] End-user quick start
- [ ] ESI Government Portal guide
- [ ] Ordering instructions

---

## Success Metrics

### Technical Metrics
- 110/110 NIST 800-171 controls automated
- <5 sec response time for compliance queries
- 99.9% uptime SLA
- Zero tenant data leaks

### Business Metrics
- GSA Schedule 70 awarded (Q3 2026)
- ESI listing active (Q4 2026)
- 3+ DoD pilot customers (Q4 2026)
- $5M+ annual revenue from ESI (2027)

### Compliance Metrics
- 100% GSA Schedule compliance
- CMMC Level 2 certification
- FedRAMP-ready status
- Zero audit findings

---

## Next Steps

1. **This Week:**
   - [ ] Create `/pkg/compliance/nist80171/` directory structure
   - [ ] Begin implementing AC (Access Control) family (22 controls)
   - [ ] Set up ESI workspace in project

2. **Next 2 Weeks:**
   - [ ] Complete 3 NIST 800-171 control families (AC, AU, AT)
   - [ ] Design enterprise licensing database schema
   - [ ] Create TCO calculator frontend prototype

3. **Next 30 Days:**
   - [ ] Complete all 14 NIST 800-171 control families
   - [ ] Implement enterprise licensing backend
   - [ ] Build ESI Government Portal MVP

4. **Next 90 Days:**
   - [ ] Full RMF automation implementation
   - [ ] Multi-tenant architecture deployed
   - [ ] GSA Schedule application submitted

**Goal:** GSA Schedule-ready by Q2 2026, ESI-listed by Q4 2026

---

*Last Updated: 2026-01-26*
*Status: Planning → Implementation*
*Next Review: Weekly during implementation*
