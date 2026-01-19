"""
Papyrus AI Endpoint - Connect to SouHimBou AGI for intelligent guidance.
"""

@app.post("/api/v1/papyrus/chat")
async def papyrus_chat(request: dict):
    """
    Papyrus AI Chat - Contextual help powered by SouHimBou AGI.
    Uses the ML anomaly detection model's soul embedding for personality.
    """
    try:
        user_message = request.get("message", "")
        current_view = request.get("context", {}).get("view", "unknown")
        
        # Build context-aware prompt
        context_prompts = {
            "executive": "You are viewing the Executive Dashboard. Focus on business impact, financial risk, and compliance scores.",
            "compliance": "You are in the Compliance Scorecard. Explain CMMC controls, SSP requirements, and audit readiness.",
            "secops": "You are in the SecOps War Room. Explain the DAG (Trust Constellation), attack paths, and remediation playbooks.",
            "intelligence": "You are in the Intelligence Watchtower. Explain external threats, CISA KEV, Shodan findings, and PQC status."
        }
        
        system_prompt = f"""You are Papyrus, the AI guide for the Khepra Protocol cybersecurity platform.
You explain complex security concepts in plain English.
Current context: {context_prompts.get(current_view, "General cybersecurity guidance")}

User's question: {user_message}

Provide a helpful, concise answer (2-3 sentences max)."""

        # Use the loaded ML model's soul embedding for personality
        if model_state.get("soul_embedding"):
            dominant_trait = max(model_state["soul_embedding"], key=model_state["soul_embedding"].get)
            system_prompt += f"\nYour dominant personality trait: {dominant_trait}"
        
        # For now, return a rule-based response
        # TODO: Connect to actual LLM (Ollama, OpenAI, etc.)
        response_text = generate_papyrus_response(user_message, current_view)
        
        return {
            "response": response_text,
            "context": current_view,
            "soul_trait": model_state.get("soul_embedding", {}).get(max(model_state.get("soul_embedding", {"default": 1}), key=model_state.get("soul_embedding", {"default": 1}).get), "Unknown")
        }
        
    except Exception as e:
        logger.error(f"Papyrus chat error: {e}")
        return {
            "response": "I apologize, but I'm having trouble processing your request. Please try again.",
            "error": str(e)
        }


def generate_papyrus_response(message: str, view: str) -> str:
    """Generate contextual responses based on keywords and view."""
    message_lower = message.lower()
    
    # DAG/Graph explanations
    if "dag" in message_lower or "graph" in message_lower or "constellation" in message_lower:
        return "The Trust Constellation (DAG) is a causal graph showing how security findings relate to each other. Red nodes are critical threats, yellow are pending, and green are resolved. Follow the arrows to see attack paths."
    
    # Compliance questions
    if "compliance" in message_lower or "cmmc" in message_lower:
        return "CMMC Level 2 requires 110 controls across 17 domains. Your current score shows how many controls are implemented. Focus on failed domains (red) first for maximum impact."
    
    # Risk/threat questions
    if "risk" in message_lower or "threat" in message_lower:
        return "Risk exposure is calculated by multiplying vulnerability severity by potential business impact. Critical findings (red) should be remediated immediately as they pose the highest financial risk."
    
    # PQC questions
    if "pqc" in message_lower or "quantum" in message_lower:
        return "Post-Quantum Cryptography (PQC) protects against future quantum computer attacks. Your PQC score shows the percentage of quantum-safe keys (Kyber/Dilithium) vs legacy crypto (RSA/ECDSA)."
    
    # Default contextual response
    if view == "executive":
        return "The Executive Dashboard shows your organization's security posture in business terms: financial risk, compliance score, and top threats. Focus on the Critical 5 findings for immediate action."
    elif view == "compliance":
        return "The Compliance Scorecard tracks your CMMC Level 2 progress. Each domain (AC, AU, SC, IR) must pass for certification. Upload evidence (POE) for each control to prove implementation."
    elif view == "secops":
        return "The SecOps War Room provides operational tools: the DAG shows attack paths, playbooks automate remediation, and the incident board tracks active IR cases."
    elif view == "intelligence":
        return "The Intelligence Watchtower correlates external threats: CISA KEV shows actively exploited vulnerabilities, Shodan reveals your attack surface, and PQC tracks quantum readiness."
    else:
        return "I'm Papyrus, your guide through the Khepra Protocol. Ask me about the DAG, compliance scores, risk exposure, or any security concept you'd like explained."
