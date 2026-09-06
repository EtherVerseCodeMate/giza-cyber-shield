import os
import sys
import time
try:
    from curl_cffi import requests
except ImportError:
    print("Please install curl_cffi: pip3 install curl_cffi")
    sys.exit(1)

# Master list of DoD CIO Library URLs
URLS = [
    "https://dodcio.defense.gov/Portals/0/Documents/CMMC/FAQsv6.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/514402p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ImplementingSuspensionCMMC-PhaseII.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CMMC-ReformMemo.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDCIO-BCA.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/USD-AS-DODCIO-Dual-Memo-ExpandingCybersecurityWorkforceByEliminatingEducationalBarriers-USA002144-22_2022114.pdf?ver=acMcyr2G9LvUbBzE59lUWg%3d%3d",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CW-StrategyImplementationPlan.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDD-8140-01.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDI-8140-02.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDM-8140-03.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/AoSPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DBSPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/MCAPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/MTAPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/SWAPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/TransitionUCA-Prog.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/UCAPathwayIntegration-RMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ATO-101SmBusinessInfo.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/(U)%202024-01-02%20DoD%20Cybersecurity%20Reciprocity%20Playbook.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/AI-CybersecurityRMTailoringGuide.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD%20CISO%20Special%20Session%20Town%20Hall%20(Feb%202022).pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/DoD%20CIO%20Signed%20Memo%20-%20DoD%20Cybersecurity%20Activities%20Performed%20for%20Cloud%20S.._.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CS-Ref-Architecture.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/520513p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/831001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/850001_2014.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/851001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/853001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/854001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/858201p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/FEDRAMP-EquivalencyCloudServiceProviders.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ResolvingRMF.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/StandardsGuideForeignPartners.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ZT-CapabilitiesActivities.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ZT-ExecutionRoadmap-v1.1.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ZT-OperationalTechnologyActivitiesOutcomes_v2.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ZT-NewsletterNov.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ZT-StrategyPlacemats.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/Memo-DoDCOTSInfoCommTechSupplyChainRisk.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/RequirementsAcquisitionDigitalCapabilitiesGuidebook.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CNAP_RefDesign_v1.0.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/NextStepRationalizeCloudUse.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CloudSecurityPlaybookOverview.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CloudSecurityPlaybookVol1.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CloudSecurityPlaybookVol2.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDCloudFinOpsStrategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/8100.02%20Use%20of%20Commercial%20Wireless%20Devices.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/842001_dodi_2017.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDCIOMemo-WirelessMobile-Spiral4.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/UseOfNon-GovernmentOwnedMobileDevices.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/Memo-UseOfTextMessagesOnMobileDevices-RM.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/Memo-UseOfUnclassMobileApps.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/Telework_Dos_and_Donts.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/BusinessSystemRationalizationPlaybook.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/BEAGuidebook.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/DoD_CIO_ICAM_Placemat.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/DoDCIOMem-MobilePKICredentials.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/DoD_Enterprise_ICAM_Reference_Design.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/852002p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/852003p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/852004p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ICAMWorkflowImplementationGuide.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/ICAM-FederationFramework.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/ICAM_Strategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/AcceleratingAdoptionICAM.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ICAMImplementationSecretFabric.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CISOMemo-SAARICAMWorkflows.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/MFA-U-S-DoDNetworks.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/RemediationIT-basedMWsImpactingFinancialAuditability.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Cyber/modernizing_the_cac.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Spectrum/2020DoD-EMS-SuperiorityStrategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Spectrum/DoD%20CIO%20Memo%20DoD%20Principles%20on%20MESE%20w-attach.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD-EMBRSS-FeasabilityAssessmentRedacted.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/322203p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/465001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/832005p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ESC-MC-ImplementationPlan.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/SoftwareModStrat.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/SW-Mod-I-Plan25-26.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/Memo-AcceleratingSecureSoftware.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/SWFT-RFI-Combined-Summary.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD%20Enterprise%20DevSecOps%20Fundamentals%20v2.5.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DevSecOpsActivitesToolsGuidebook.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DevSecOps%20Playbook_DoD-CIO_20211019.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DevSecOpsStateOf.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD%20Enterprise%20DevSecOps%20Reference%20Design%20-%20CNCF%20Kubernetes%20w-DD1910_cleared_20211022.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDReferenceDesign-CNCFMulti-ClusterKubernetes.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD%20Enterprise%20DevSecOps%20Reference%20Design%20-%20AWS%20Managed%20Services_DoD-CIO_20211019.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDRefDesignCloudGithub.pdf?ver=zXJ_uO5LfouVaysHo5Ejsw%3d%3d",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD%20Enterprise%20DevSecOps-Pathway%20to%20a%20Reference%20Design_DoD-CIO_20211018.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/SoftwareDev-OpenSource.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/20220204-cATO-memo-Signed-Cleared.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/cATO-EvaluationCriteria.pdf?ver=A8tLIfPjmp3RpemU6JOhJw%3d%3d",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDCIO-ContinuousAuthorizationImplementationGuide.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/500082p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodd/800001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/801001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/833001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/841001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/855101p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CIOMemo-ComponentsCombatantCommandsNetworkOptimizationExecutionGuidance.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/MemoEMWNArchitectureRequirements.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoW-PQC-Strategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/PreparingForMigrationPQC.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/811001p.pdf",
    "https://www.esd.whs.mil/Portals/54/Documents/DD/issuances/dodi/817001p.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DIB-CS-Strategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/DoD-C3-Strategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/Private5GDeploymentStrategy_508.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/CWF-Strategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD-OCONUSCloudStrategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoDRecordsStrategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/DoD-ZTStrategy.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/(U)ZT_RA_v2.0(U)_Sep22.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/FulcrumAdvStrat.pdf",
    "https://dodcio.defense.gov/Portals/0/Documents/Library/ICT-ServicesSupplyChain-RMA.pdf",
    "https://media.defense.gov/2023/Sep/12/2003299076/-1/-1/1/2023_DOD_Cyber_Strategy_Summary.pdf"
]

# Deduplicate
URLS = list(dict.fromkeys(URLS))

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "governance", "dod_cio")

def download_file(url, output_dir):
    filename = url.split('/')[-1].split('?')[0].replace('%20', '_')
    filepath = os.path.join(output_dir, filename)
    
    if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
        print(f"[SKIP] {filename} already exists.")
        return True

    try:
        print(f"[DOWNLOADING] {filename}...")
        # curl_cffi perfectly mimics Chrome's TLS fingerprint to bypass Akamai
        response = requests.get(url, impersonate="chrome110")
        if response.status_code == 200:
            with open(filepath, 'wb') as out_file:
                out_file.write(response.content)
            print(f"[SUCCESS] Saved {filename} ({len(response.content)} bytes)")
            return True
        else:
            print(f"[ERROR] HTTP Error {response.status_code}: {response.reason} for {url}")
            return False
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e} for {url}")
        return False

def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    print(f"Target Directory: {OUTPUT_DIR}")
    
    success_count = 0
    for url in URLS:
        if download_file(url, OUTPUT_DIR):
            success_count += 1
        time.sleep(2.0)
        
    print(f"\nDownload complete! {success_count}/{len(URLS)} files saved to {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
