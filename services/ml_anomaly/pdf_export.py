"""
PDF Report Generation for Compliance.
Generates executive-ready CMMC Level 2 compliance reports.
"""
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from io import BytesIO
from datetime import datetime
import subprocess
import json

@app.get("/api/v1/export/compliance-report")
async def export_compliance_report():
    """
    Generate PDF compliance report from current CMMC status.
    Returns a downloadable PDF file.
    """
    try:
        # Fetch current compliance data
        result = subprocess.run(
            ["adinkhepra", "compliance", "status", "--json"],
            capture_output=True,
            text=True,
            timeout=15
        )
        
        if result.returncode == 0 and result.stdout.strip():
            compliance_data = json.loads(result.stdout)
        else:
            # Use placeholder data
            compliance_data = {
                "score": 0.0,
                "level": "Unknown",
                "controls": {"total": 110, "passing": 0, "failing": 0},
                "domains": {}
            }
        
        # Generate PDF
        pdf_buffer = BytesIO()
        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter)
        story = []
        styles = getSampleStyleSheet()
        
        # Custom styles
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=16,
            textColor=colors.HexColor('#1e40af'),
            spaceAfter=12,
        )
        
        # Title
        story.append(Paragraph("CMMC Level 2 Compliance Report", title_style))
        story.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", styles['Normal']))
        story.append(Spacer(1, 0.5*inch))
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", heading_style))
        summary_data = [
            ["Metric", "Value"],
            ["Compliance Score", f"{compliance_data.get('score', 0)}%"],
            ["CMMC Level", compliance_data.get('level', 'Unknown')],
            ["Total Controls", str(compliance_data.get('controls', {}).get('total', 110))],
            ["Passing Controls", str(compliance_data.get('controls', {}).get('passing', 0))],
            ["Failing Controls", str(compliance_data.get('controls', {}).get('failing', 0))],
        ]
        
        summary_table = Table(summary_data, colWidths=[3*inch, 3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        story.append(summary_table)
        story.append(Spacer(1, 0.5*inch))
        
        # Domain Breakdown
        story.append(Paragraph("Domain Breakdown", heading_style))
        domains = compliance_data.get('domains', {})
        
        if domains:
            domain_data = [["Domain", "Score", "Status"]]
            for domain_code, domain_info in domains.items():
                domain_data.append([
                    get_domain_name(domain_code),
                    f"{domain_info.get('score', 0)}%",
                    domain_info.get('status', 'UNKNOWN')
                ])
            
            domain_table = Table(domain_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
            domain_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e40af')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 12),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black)
            ]))
            story.append(domain_table)
        else:
            story.append(Paragraph("No domain data available.", styles['Normal']))
        
        story.append(Spacer(1, 0.5*inch))
        
        # Recommendations
        story.append(Paragraph("Recommendations", heading_style))
        score = compliance_data.get('score', 0)
        
        if score < 50:
            recommendations = [
                "• Immediate action required: Compliance score is critically low",
                "• Focus on failed domains first for maximum impact",
                "• Engage with C3PAO for assessment readiness review",
                "• Implement automated remediation playbooks",
            ]
        elif score < 80:
            recommendations = [
                "• Good progress: Continue implementing remaining controls",
                "• Review and update System Security Plan (SSP)",
                "• Collect evidence (POE) for implemented controls",
                "• Schedule internal audit before C3PAO assessment",
            ]
        else:
            recommendations = [
                "• Excellent compliance posture",
                "• Ready for C3PAO assessment",
                "• Maintain continuous monitoring",
                "• Document all changes in SSP",
            ]
        
        for rec in recommendations:
            story.append(Paragraph(rec, styles['Normal']))
        
        story.append(Spacer(1, 0.5*inch))
        
        # Footer
        story.append(PageBreak())
        story.append(Paragraph("Generated by Khepra Protocol - SouHimBou AI", styles['Normal']))
        story.append(Paragraph("Trust Constellation • Causal Security Analysis", styles['Normal']))
        
        # Build PDF
        doc.build(story)
        pdf_buffer.seek(0)
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=cmmc-compliance-report-{datetime.now().strftime('%Y%m%d')}.pdf"
            }
        )
        
    except Exception as e:
        logger.error(f"PDF generation failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


def get_domain_name(code: str) -> str:
    """Get full domain name from code."""
    names = {
        "AC": "Access Control",
        "AU": "Audit & Accountability",
        "AT": "Awareness & Training",
        "CM": "Configuration Management",
        "IA": "Identification & Authentication",
        "IR": "Incident Response",
        "MA": "Maintenance",
        "MP": "Media Protection",
        "PS": "Personnel Security",
        "PE": "Physical Protection",
        "RE": "Recovery",
        "RM": "Risk Management",
        "CA": "Security Assessment",
        "SC": "System & Communications Protection",
        "SI": "System & Information Integrity",
        "SA": "System & Services Acquisition",
    }
    return names.get(code, code)
