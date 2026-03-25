# System Security Plan (SSP)
System: AdinKhepra Protocol
Organization: Khepra Protocol
Date Generated: Mon, 09 Feb 2026 18:30:18 EST
Compliance Baseline: NIST 800-171 Rev 2 + NIST 800-172 (Enhanced)

## NIST 800-171 Control Implementation Details

### Control 3.1.1: Limit System Access
- **Status**: PASS
- **Family**: Access Control
- **Finding**: Access is restricted via standard OS identity management.

### Control 3.1.2: Transaction & Function Control
- **Status**: PASS
- **Family**: Access Control
- **Finding**: 

### Control 3.1.3: CUI Flow Control
- **Status**: PASS
- **Family**: Access Control
- **Finding**: 

### Control 3.1.4: 
- **Status**: MANUAL_REVIEW
- **Family**: Access Control
- **Finding**: 

### Control 3.1.5: Least Privilege
- **Status**: PASS
- **Family**: Access Control
- **Finding**: 

### Control 3.1.6: 
- **Status**: MANUAL_REVIEW
- **Family**: Access Control
- **Finding**: 

### Control 3.1.7: 
- **Status**: MANUAL_REVIEW
- **Family**: Access Control
- **Finding**: 

### Control 3.1.8: Limit Unsuccessful Logon Attempts
- **Status**: PASS
- **Family**: Access Control
- **Finding**: authselect and pam_faillock configured to lockout after 3 attempts.

### Control 3.1.9: 
- **Status**: MANUAL_REVIEW
- **Family**: Access Control
- **Finding**: 

### Control 3.1.10: Prevent Privileged Function Execution
- **Status**: PASS
- **Family**: Access Control
- **Finding**: 

## NIST 800-172 Enhanced Requirement Details

### Enhanced Requirement 3.1.1e: Dual Authorization
- **Status**: MANUAL_REVIEW
- **Family**: Access Control
- **Finding**: Dual authorization policy needs to be defined and verified for crypto-key access.

### Enhanced Requirement 3.1.2e: Restrict Identifier Access
- **Status**: PASS
- **Family**: Access Control
- **Finding**: Access to /etc/shadow and kernel keyrings restricted to root/system processes.

### Enhanced Requirement 3.1.3e: Security Function Isolation
- **Status**: PASS
- **Family**: Access Control
- **Finding**: Khepra core services run in isolated SELinux domains with minimal capability sets.

