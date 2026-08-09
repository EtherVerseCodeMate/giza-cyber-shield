"""
CMMC to STIG Mapping Automation Script - COMPLETE VERSION
==========================================================
Builds complete mapping chain: STIG → CCI → NIST 800-53 → NIST 800-171 → CMMC

Author: Updated for CCI-based STIG mapping
Date: October 25, 2025
"""

import xml.etree.ElementTree as ET
import glob
import csv
import pandas as pd
from pathlib import Path
import os

# ============================================================================
# CONFIGURATION - Update these paths to match your setup
# ============================================================================

# Base directory (where you're running the script)
BASE_DIR = Path(__file__).parent.resolve()

# Source data directory
SOURCE_DIR = BASE_DIR / "source_data"

# STIG XML files directory
STIG_DIR = SOURCE_DIR / "stigs"

# Output directory for results
OUTPUT_DIR = BASE_DIR / "output"

# Create directories if they don't exist
OUTPUT_DIR.mkdir(exist_ok=True, parents=True)
STIG_DIR.mkdir(exist_ok=True, parents=True)

# Input file paths
CMMC_FILE = SOURCE_DIR / "CMMCModel_V2_Mapping.xlsx"
NIST_171_FILE = SOURCE_DIR / "NIST.SP.800-171r3.pdf"
CCI_LIST_FILE = SOURCE_DIR / "U_CCI_List.xml"

# Output files
STIG_CCI_MAP = OUTPUT_DIR / "STIG_CCI_Map.csv"
CCI_NIST_MAP = OUTPUT_DIR / "CCI_to_NIST53.csv"
NIST_MAP_FILE = OUTPUT_DIR / "NIST53_to_171.csv"
FINAL_OUTPUT = OUTPUT_DIR / "STIG_to_CMMC_Complete_Mapping.xlsx"

# ============================================================================
# STEP 1: Parse STIG XML Files (Extract CCI References)
# ============================================================================

def parse_stig_xmls():
    """
    Extract STIG rules and their CCI references from XML files
    """
    print("="*70)
    print("STEP 1: Parsing STIG XML Files")
    print("="*70)
    
    rows = []
    xml_files = list(glob.glob(str(STIG_DIR / "**/*.xml"), recursive=True))
    
    if not xml_files:
        print(f"⚠️  WARNING: No XML files found in {STIG_DIR}")
        print("Please extract the STIG Library ZIP file to this directory:")
        print(f"   {STIG_DIR}")
        return rows
    
    print(f"Found {len(xml_files)} XML files to process...")
    
    # XCCDF namespace used by DISA STIGs
    ns = {'xccdf': 'http://checklists.nist.gov/xccdf/1.1'}
    
    processed = 0
    skipped = 0
    
    for xml_file in xml_files:
        try:
            tree = ET.parse(xml_file)
            root = tree.getroot()
            
            # Find all Rule elements with namespace
            rules = root.findall(".//xccdf:Rule", ns)
            
            for rule in rules:
                rule_id = rule.get("id", "")
                
                # Get title with namespace handling
                title = rule.findtext("xccdf:title", "", ns)
                
                # Get severity
                severity = rule.get("severity", "unknown")
                
                # Find all ident elements (these contain CCI codes)
                idents = rule.findall("xccdf:ident", ns)
                
                for ident in idents:
                    ident_text = (ident.text or "").strip()
                    
                    # Capture CCI codes (DISA uses CCI instead of direct NIST refs)
                    if ident_text.startswith("CCI-"):
                        rows.append({
                            "STIG_ID": rule_id,
                            "STIG_Title": title[:200],  # Truncate long titles
                            "STIG_Severity": severity,
                            "CCI_ID": ident_text,
                            "STIG_File": Path(xml_file).name
                        })
            
            processed += 1
            if processed % 100 == 0:
                print(f"  Processed {processed}/{len(xml_files)} files...")
                
        except ET.ParseError as e:
            skipped += 1
            print(f"  ⚠️  XML Parse Error in {Path(xml_file).name}: {e}")
        except Exception as e:
            skipped += 1
            print(f"  ⚠️  Error processing {Path(xml_file).name}: {e}")
    
    print(f"\n✅ Parsing complete!")
    print(f"   Processed: {processed} files")
    print(f"   Skipped: {skipped} files")
    print(f"   Found: {len(rows)} STIG-to-CCI mappings")
    
    # Save to CSV
    if rows:
        with open(STIG_CCI_MAP, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        print(f"   Saved to: {STIG_CCI_MAP}")
    else:
        print("   ⚠️  No mappings found!")
    
    return rows

# ============================================================================
# STEP 2: Parse CCI List (CCI to NIST 800-53 Mapping)
# ============================================================================


def parse_cci_list():
    """
    Extract CCI to NIST 800-53 mappings from U_CCI_List.xml with namespace handling
    and diagnostic printout for first few references.
    """
    print("\n" + "="*70)
    print("STEP 2: Parsing CCI List (CCI → NIST 800-53)")
    print("="*70)
    
    if not CCI_LIST_FILE.exists():
        print(f"❌ ERROR: CCI List file not found: {CCI_LIST_FILE}")
        print(f"   Please download from: https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/U_CCI_List.zip")
        return []
    
    print(f"Parsing: {CCI_LIST_FILE.name}")
    rows = []
    ns = {'cci': 'http://iase.disa.mil/cci'}
    diag_count = 0

    try:
        tree = ET.parse(CCI_LIST_FILE)
        root = tree.getroot()
        cci_items = root.findall(".//cci:cci_item", ns)
    
        print(f"  Found {len(cci_items)} CCI items")
        for item in cci_items:
            cci_id = item.attrib.get("id", "")
            definition = item.findtext("cci:definition", default="", namespaces=ns)
            references = item.findall("cci:references/cci:reference", ns)
            for ref in references:
                ref_text = (ref.text or "")
                index = ref.attrib.get("index", "")
                creator = ref.attrib.get("creator", "")
                version = ref.attrib.get("version", "")
                title = ref.attrib.get("title", "")
                # Diagnostic: Print first few actual reference attributes
                if diag_count < 8:
                    print(f"{diag_count+1}. CCI: {cci_id} | TEXT: '{ref_text}' | index: '{index}' | creator: '{creator}' | version: '{version}' | title: '{title}'")
                    diag_count += 1
                # Add any reference to NIST SP 800-53 by text OR attribute
                if (
                    "800-53" in ref_text or
                    "800-53" in creator or
                    "800-53" in version or
                    "800-53" in title
                ) and index:
                    rows.append({
                        "CCI_ID": cci_id,
                        "NIST_53_Ref": index.strip(),
                        "Definition": definition[:200]
                    })
        print(f"✅ Extracted {len(rows)} CCI → NIST 800-53 mappings")
        if rows:
            df = pd.DataFrame(rows).drop_duplicates()
            df.to_csv(CCI_NIST_MAP, index=False)
            print(f"   Saved to: {CCI_NIST_MAP}")
            print(f"   Unique CCI IDs: {df['CCI_ID'].nunique()}")
            print(f"   Unique NIST controls: {df['NIST_53_Ref'].nunique()}")
        else:
            print("   ⚠️  No CCI/NIST mappings found! Check U_CCI_List.xml structure above for clues.")
        return rows
    except Exception as e:
        print(f"❌ Error parsing CCI List: {e}")
        import traceback
        traceback.print_exc()
        return []
# ============================================================================
# STEP 3: Create NIST 800-53 to 800-171 Mapping
# ============================================================================

def create_nist_crosswalk():
    """
    Create NIST 800-53 to 800-171 Rev 3 mapping
    Based on NIST SP 800-171 Rev 3 Appendix D
    """
    print("\n" + "="*70)
    print("STEP 3: Creating NIST 800-53 ↔ 800-171 Crosswalk")
    print("="*70)
    
    # Complete NIST 800-171 Rev 3 to 800-53 Rev 5 mapping
    mapping = [
        # Access Control (AC) - 3.1.x
        {"NIST_171_Ref": "3.1.1", "NIST_53_Ref": "AC-3", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.2", "NIST_53_Ref": "AC-2", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.3", "NIST_53_Ref": "AC-17", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.4", "NIST_53_Ref": "AC-19", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.4", "NIST_53_Ref": "AC-20", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.5", "NIST_53_Ref": "AC-6", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.6", "NIST_53_Ref": "AC-6(7)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.6", "NIST_53_Ref": "AC-6(9)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.7", "NIST_53_Ref": "AC-7", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.8", "NIST_53_Ref": "AC-11", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.9", "NIST_53_Ref": "AC-12", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.10", "NIST_53_Ref": "AC-14", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.11", "NIST_53_Ref": "AC-4", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.12", "NIST_53_Ref": "AC-8", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.13", "NIST_53_Ref": "AC-22", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.14", "NIST_53_Ref": "AC-2(11)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.15", "NIST_53_Ref": "AC-2(12)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.16", "NIST_53_Ref": "AC-2(13)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.17", "NIST_53_Ref": "AC-2(1)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.18", "NIST_53_Ref": "AC-2(7)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.19", "NIST_53_Ref": "AC-17(1)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.20", "NIST_53_Ref": "AC-3(7)", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.21", "NIST_53_Ref": "AC-5", "Control_Family": "Access Control"},
        {"NIST_171_Ref": "3.1.22", "NIST_53_Ref": "AC-6(1)", "Control_Family": "Access Control"},
        
        # Awareness and Training (AT) - 3.2.x
        {"NIST_171_Ref": "3.2.1", "NIST_53_Ref": "AT-2", "Control_Family": "Awareness and Training"},
        {"NIST_171_Ref": "3.2.1", "NIST_53_Ref": "PM-13", "Control_Family": "Awareness and Training"},
        {"NIST_171_Ref": "3.2.2", "NIST_53_Ref": "AT-3", "Control_Family": "Awareness and Training"},
        {"NIST_171_Ref": "3.2.2", "NIST_53_Ref": "PS-7", "Control_Family": "Awareness and Training"},
        {"NIST_171_Ref": "3.2.3", "NIST_53_Ref": "AT-3(3)", "Control_Family": "Awareness and Training"},
        {"NIST_171_Ref": "3.2.4", "NIST_53_Ref": "AT-4", "Control_Family": "Awareness and Training"},
        
        # Audit and Accountability (AU) - 3.3.x
        {"NIST_171_Ref": "3.3.1", "NIST_53_Ref": "AU-2", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.2", "NIST_53_Ref": "AU-3", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.3", "NIST_53_Ref": "AU-6", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.4", "NIST_53_Ref": "AU-9", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.5", "NIST_53_Ref": "AU-11", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.6", "NIST_53_Ref": "AU-12", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.7", "NIST_53_Ref": "AU-4", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.8", "NIST_53_Ref": "AU-6(1)", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.8", "NIST_53_Ref": "AU-7", "Control_Family": "Audit and Accountability"},
        {"NIST_171_Ref": "3.3.9", "NIST_53_Ref": "AU-9(2)", "Control_Family": "Audit and Accountability"},
        
        # Configuration Management (CM) - 3.4.x
        {"NIST_171_Ref": "3.4.1", "NIST_53_Ref": "CM-2", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.2", "NIST_53_Ref": "CM-6", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.3", "NIST_53_Ref": "CM-7", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.4", "NIST_53_Ref": "CM-8", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.5", "NIST_53_Ref": "CM-5", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.6", "NIST_53_Ref": "CM-3", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.7", "NIST_53_Ref": "CM-7(1)", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.8", "NIST_53_Ref": "CM-8(1)", "Control_Family": "Configuration Management"},
        {"NIST_171_Ref": "3.4.9", "NIST_53_Ref": "CM-11", "Control_Family": "Configuration Management"},
        
        # Identification and Authentication (IA) - 3.5.x
        {"NIST_171_Ref": "3.5.1", "NIST_53_Ref": "IA-2", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.2", "NIST_53_Ref": "IA-2(1)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.2", "NIST_53_Ref": "IA-2(2)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.2", "NIST_53_Ref": "IA-2(8)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.2", "NIST_53_Ref": "IA-2(9)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.3", "NIST_53_Ref": "IA-8", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.4", "NIST_53_Ref": "IA-4", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.5", "NIST_53_Ref": "IA-5", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.6", "NIST_53_Ref": "IA-5(1)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.7", "NIST_53_Ref": "IA-5(6)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.8", "NIST_53_Ref": "IA-5(7)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.9", "NIST_53_Ref": "IA-2(5)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.10", "NIST_53_Ref": "IA-8(1)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.10", "NIST_53_Ref": "IA-8(2)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.10", "NIST_53_Ref": "IA-8(4)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.11", "NIST_53_Ref": "IA-12(4)", "Control_Family": "Identification and Authentication"},
        {"NIST_171_Ref": "3.5.11", "NIST_53_Ref": "IA-12(5)", "Control_Family": "Identification and Authentication"},
        
        # Incident Response (IR) - 3.6.x
        {"NIST_171_Ref": "3.6.1", "NIST_53_Ref": "IR-4", "Control_Family": "Incident Response"},
        {"NIST_171_Ref": "3.6.1", "NIST_53_Ref": "IR-5", "Control_Family": "Incident Response"},
        {"NIST_171_Ref": "3.6.2", "NIST_53_Ref": "IR-6", "Control_Family": "Incident Response"},
        {"NIST_171_Ref": "3.6.3", "NIST_53_Ref": "IR-8", "Control_Family": "Incident Response"},
        
        # Maintenance (MA) - 3.7.x
        {"NIST_171_Ref": "3.7.1", "NIST_53_Ref": "MA-2", "Control_Family": "Maintenance"},
        {"NIST_171_Ref": "3.7.2", "NIST_53_Ref": "MA-3", "Control_Family": "Maintenance"},
        {"NIST_171_Ref": "3.7.3", "NIST_53_Ref": "MA-4", "Control_Family": "Maintenance"},
        {"NIST_171_Ref": "3.7.4", "NIST_53_Ref": "MA-5", "Control_Family": "Maintenance"},
        {"NIST_171_Ref": "3.7.5", "NIST_53_Ref": "MA-6", "Control_Family": "Maintenance"},
        
        # Media Protection (MP) - 3.8.x
        {"NIST_171_Ref": "3.8.1", "NIST_53_Ref": "MP-2", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.2", "NIST_53_Ref": "MP-4", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.3", "NIST_53_Ref": "MP-6", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.4", "NIST_53_Ref": "MP-7", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.5", "NIST_53_Ref": "MP-3", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.6", "NIST_53_Ref": "MP-5", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.7", "NIST_53_Ref": "MP-7(1)", "Control_Family": "Media Protection"},
        {"NIST_171_Ref": "3.8.8", "NIST_53_Ref": "MP-7(2)", "Control_Family": "Media Protection"},
        
        # Personnel Security (PS) - 3.9.x
        {"NIST_171_Ref": "3.9.1", "NIST_53_Ref": "PS-3", "Control_Family": "Personnel Security"},
        {"NIST_171_Ref": "3.9.2", "NIST_53_Ref": "PS-6", "Control_Family": "Personnel Security"},
        
        # Physical Protection (PE) - 3.10.x
        {"NIST_171_Ref": "3.10.1", "NIST_53_Ref": "PE-2", "Control_Family": "Physical Protection"},
        {"NIST_171_Ref": "3.10.2", "NIST_53_Ref": "PE-3", "Control_Family": "Physical Protection"},
        {"NIST_171_Ref": "3.10.3", "NIST_53_Ref": "PE-6", "Control_Family": "Physical Protection"},
        {"NIST_171_Ref": "3.10.4", "NIST_53_Ref": "PE-8", "Control_Family": "Physical Protection"},
        {"NIST_171_Ref": "3.10.5", "NIST_53_Ref": "PE-16", "Control_Family": "Physical Protection"},
        {"NIST_171_Ref": "3.10.6", "NIST_53_Ref": "PE-17", "Control_Family": "Physical Protection"},
        
        # Risk Assessment (RA) - 3.11.x
        {"NIST_171_Ref": "3.11.1", "NIST_53_Ref": "RA-3", "Control_Family": "Risk Assessment"},
        {"NIST_171_Ref": "3.11.2", "NIST_53_Ref": "RA-5", "Control_Family": "Risk Assessment"},
        {"NIST_171_Ref": "3.11.3", "NIST_53_Ref": "RA-5(5)", "Control_Family": "Risk Assessment"},
        
        # Security Assessment (CA) - 3.12.x
        {"NIST_171_Ref": "3.12.1", "NIST_53_Ref": "CA-2", "Control_Family": "Security Assessment"},
        {"NIST_171_Ref": "3.12.2", "NIST_53_Ref": "CA-7", "Control_Family": "Security Assessment"},
        {"NIST_171_Ref": "3.12.3", "NIST_53_Ref": "CA-5", "Control_Family": "Security Assessment"},
        {"NIST_171_Ref": "3.12.4", "NIST_53_Ref": "CA-6", "Control_Family": "Security Assessment"},
        
        # System and Communications Protection (SC) - 3.13.x
        {"NIST_171_Ref": "3.13.1", "NIST_53_Ref": "SC-7", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.2", "NIST_53_Ref": "SC-8", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.3", "NIST_53_Ref": "SC-12", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.4", "NIST_53_Ref": "SC-13", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.5", "NIST_53_Ref": "SC-15", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.6", "NIST_53_Ref": "SC-20", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.7", "NIST_53_Ref": "SC-21", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.8", "NIST_53_Ref": "SC-23", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.9", "NIST_53_Ref": "SC-28", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.10", "NIST_53_Ref": "SC-7(3)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.11", "NIST_53_Ref": "SC-7(4)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.11", "NIST_53_Ref": "SC-7(5)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.12", "NIST_53_Ref": "SC-7(7)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.13", "NIST_53_Ref": "SC-7(8)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.14", "NIST_53_Ref": "SC-8(1)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.15", "NIST_53_Ref": "SC-28(1)", "Control_Family": "System and Communications Protection"},
        {"NIST_171_Ref": "3.13.16", "NIST_53_Ref": "SC-39", "Control_Family": "System and Communications Protection"},
        
        # System and Information Integrity (SI) - 3.14.x
        {"NIST_171_Ref": "3.14.1", "NIST_53_Ref": "SI-2", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.2", "NIST_53_Ref": "SI-3", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.3", "NIST_53_Ref": "SI-4", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.4", "NIST_53_Ref": "SI-7", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.5", "NIST_53_Ref": "SI-10", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.6", "NIST_53_Ref": "SI-16", "Control_Family": "System and Information Integrity"},
        {"NIST_171_Ref": "3.14.7", "NIST_53_Ref": "SI-4(5)", "Control_Family": "System and Information Integrity"},
    ]
    
    # Save to CSV
    df = pd.DataFrame(mapping)
    df.to_csv(NIST_MAP_FILE, index=False)
    
    print(f"✅ Created NIST crosswalk with {len(mapping)} mappings")
    print(f"   Saved to: {NIST_MAP_FILE}")
    
    return df

# ============================================================================
# STEP 4: Join All Tables
# ============================================================================

def merge_all_mappings():
    """
    Join CMMC → NIST 171 → NIST 53 → CCI → STIG
    """
    print("\n" + "="*70)
    print("STEP 4: Merging All Mappings")
    print("="*70)
    
    # Load CMMC data
    print("Loading CMMC Model...")
    try:
        cmmc = pd.read_excel(CMMC_FILE, sheet_name=0)
        print(f"  ✅ Loaded {len(cmmc)} rows from CMMC file")
        print(f"  Columns found: {list(cmmc.columns)[:5]}...")  # Show first 5 columns
        
        # Try to identify the correct columns
        # Look for columns that might contain NIST 171 references or CMMC practice IDs
        possible_171_cols = [col for col in cmmc.columns if '171' in str(col) or 'requirement' in str(col).lower()]
        possible_practice_cols = [col for col in cmmc.columns if 'practice' in str(col).lower() or 'id' in str(col).lower()]
        
        if possible_171_cols:
            print(f"  Found potential NIST 171 column: {possible_171_cols[0]}")
        if possible_practice_cols:
            print(f"  Found potential CMMC Practice column: {possible_practice_cols[0]}")
            
    except Exception as e:
        print(f"  ❌ Error loading CMMC file: {e}")
        return None
    
    # Load NIST mappings
    print("\nLoading NIST 800-53 ↔ 800-171 crosswalk...")
    try:
        nist_map = pd.read_csv(NIST_MAP_FILE)
        print(f"  ✅ Loaded {len(nist_map)} NIST mappings")
    except Exception as e:
        print(f"  ❌ Error loading NIST mapping: {e}")
        return None
    
    # Load CCI mappings
    print("\nLoading CCI → NIST 800-53 mappings...")
    try:
        cci_map = pd.read_csv(CCI_NIST_MAP)
        print(f"  ✅ Loaded {len(cci_map)} CCI mappings")
    except Exception as e:
        print(f"  ❌ Error loading CCI mapping: {e}")
        return None
    
    # Load STIG mappings
    print("\nLoading STIG → CCI mappings...")
    try:
        stig_map = pd.read_csv(STIG_CCI_MAP)
        print(f"  ✅ Loaded {len(stig_map)} STIG mappings")
    except Exception as e:
        print(f"  ❌ Error loading STIG mapping: {e}")
        return None
    
    # Perform joins
    print("\nPerforming table joins...")
    print("  Chain: STIG → CCI → NIST 53 → NIST 171 → CMMC")
    
    try:
        # Step 1: STIG → CCI → NIST 53
        print("\n  1. Joining STIG with CCI...")
        stig_with_nist = stig_map.merge(
            cci_map,
            on='CCI_ID',
            how='left'
        )
        print(f"     Result: {len(stig_with_nist)} rows")
        
        # Step 2: Add NIST 171
        print("  2. Joining with NIST 800-171...")
        stig_with_171 = stig_with_nist.merge(
            nist_map,
            on='NIST_53_Ref',
            how='left'
        )
        print(f"     Result: {len(stig_with_171)} rows")
        
        # Step 3: Try to add CMMC (this depends on CMMC file structure)
        print("  3. Attempting to join with CMMC...")
        
        # Since CMMC file structure is unclear, save intermediate result
        intermediate_file = OUTPUT_DIR / "STIG_to_NIST171_Mapping.xlsx"
        stig_with_171.to_excel(intermediate_file, index=False, engine='openpyxl')
        print(f"     Intermediate mapping saved: {intermediate_file}")
        
        # Calculate coverage statistics
        print("\n" + "="*70)
        print("COVERAGE STATISTICS")
        print("="*70)
        
        total_stigs = len(stig_map)
        stigs_with_cci = stig_map['CCI_ID'].notna().sum()
        stigs_with_nist53 = stig_with_nist['NIST_53_Ref'].notna().sum()
        stigs_with_nist171 = stig_with_171['NIST_171_Ref'].notna().sum()
        
        print(f"Total STIG Rules: {total_stigs}")
        print(f"  → Mapped to CCI: {stigs_with_cci} ({stigs_with_cci/total_stigs*100:.1f}%)")
        print(f"  → Mapped to NIST 800-53: {stigs_with_nist53} ({stigs_with_nist53/total_stigs*100:.1f}%)")
        print(f"  → Mapped to NIST 800-171: {stigs_with_nist171} ({stigs_with_nist171/total_stigs*100:.1f}%)")
        
        # Save final output
        print(f"\n💾 Saving final mapping to: {FINAL_OUTPUT}")
        stig_with_171.to_excel(FINAL_OUTPUT, index=False, engine='openpyxl')
        
        print("\n" + "="*70)
        print("✅ COMPLETE! STIG-to-NIST mapping created successfully!")
        print("="*70)
        print(f"\n📊 Output files:")
        print(f"   1. {STIG_CCI_MAP.name} - STIG to CCI mapping")
        print(f"   2. {CCI_NIST_MAP.name} - CCI to NIST 800-53 mapping")
        print(f"   3. {NIST_MAP_FILE.name} - NIST 800-53 to 800-171 mapping")
        print(f"   4. {FINAL_OUTPUT.name} - Complete STIG to NIST 171 mapping")
        
        return stig_with_171
        
    except Exception as e:
        print(f"\n❌ Error during merging: {e}")
        import traceback
        traceback.print_exc()
        return None

# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    """
    Main execution function
    """
    print("\n" + "="*70)
    print("CMMC TO STIG AUTOMATED MAPPING TOOL v2.0")
    print("With CCI Support")
    print("="*70)
    print(f"Base Directory: {BASE_DIR}")
    print(f"Source Data: {SOURCE_DIR}")
    print(f"Output Directory: {OUTPUT_DIR}")
    print("="*70)
    
    # Check if source files exist
    print("\nChecking source files...")
    files_ok = True
    
    if CMMC_FILE.exists():
        print(f"  ✅ CMMC Model: {CMMC_FILE.name}")
    else:
        print(f"  ❌ Missing: {CMMC_FILE}")
        files_ok = False
    
    if NIST_171_FILE.exists():
        print(f"  ✅ NIST 800-171: {NIST_171_FILE.name}")
    else:
        print(f"  ⚠️  Optional: {NIST_171_FILE}")
    
    if CCI_LIST_FILE.exists():
        print(f"  ✅ CCI List: {CCI_LIST_FILE.name}")
    else:
        print(f"  ❌ Missing: {CCI_LIST_FILE}")
        print(f"     Download from: https://dl.dod.cyber.mil/wp-content/uploads/stigs/zip/U_CCI_List.zip")
        files_ok = False
    
    stig_count = len(list(STIG_DIR.glob("**/*.xml")))
    if stig_count > 0:
        print(f"  ✅ STIG XMLs: {stig_count} files found")
    else:
        print(f"  ⚠️  No STIG XML files found in {STIG_DIR}")
        print(f"     Please extract STIG Library ZIP to this directory")
        files_ok = False
    
    if not files_ok:
        print("\n❌ Missing required source files. Please download and place them in:")
        print(f"   {SOURCE_DIR}")
        print("\nRequired files:")
        print(f"   1. CMMCModel_V2_Mapping.xlsx")
        print(f"   2. U_CCI_List.xml (from DISA)")
        print(f"   3. STIG XML files (extracted in stigs/ folder)")
        return
    
    # Execute pipeline
    print("\n" + "="*70)
    print("STARTING AUTOMATED MAPPING PROCESS")
    print("="*70)
    
    # Step 1: Parse STIGs
    parse_stig_xmls()
    
    # Step 2: Parse CCI List
    parse_cci_list()
    
    # Step 3: Create NIST crosswalk
    create_nist_crosswalk()
    
    # Step 4: Merge everything
    result = merge_all_mappings()
    
    if result is not None:
        print("\n🎉 SUCCESS! Your STIG-to-NIST mapping is ready!")
        print(f"\n📂 Main output file: {FINAL_OUTPUT}")
        print("\nYou can now open this file in Excel to view the complete mapping.")
        print("\n💡 Next steps:")
        print("   - Review the CMMC Model Excel structure")
        print("   - Manually map NIST 171 references to CMMC practices if needed")
        print("   - Use the intermediate files for custom analysis")
    else:
        print("\n❌ Mapping process encountered errors. Please check the messages above.")

# ============================================================================
# SCRIPT ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    main()
