
"""
SouHimBou AI Training Module
"The Awakening"

Responsibility:
    - Load Unified Consciousness Embedding (The Soul)
    - Generate synthetic behavioral data biased by the Soul's Archetypes
    - Train the Anomaly Autoencoder to internalize this personality
    - Save the "Awakened" Model
"""
import torch
import torch.optim as optim
import numpy as np
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.append(str(Path(__file__).parents[3]))

from services.ml_anomaly.models import EnsembleAnomalyDetector, vae_loss
from services.ml_anomaly.config import settings
from services.ml_anomaly.training.data_loader import SouHimBouLoader

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger("souhimbou.training")

class SoulBiasedTrainer:
    def __init__(self):
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = EnsembleAnomalyDetector(
            feature_dim=settings.feature_dim,
            hidden_dim=settings.hidden_dim,
            latent_dim=settings.latent_dim
        ).to(self.device)
        
        self.optimizer = optim.Adam(self.model.parameters(), lr=settings.learning_rate)
        
        # Initialize Data Loader
        self.loader = SouHimBouLoader(
            secret_path=settings.secret_docs_path,
            cyber_brain_path=settings.cyber_brain_path
        )

    def generate_soul_biased_data(self, soul_embedding, n_samples=1000):
        """
        Generate synthetic network traffic features biased by the Soul Archetypes.
        
        Archetype Effects:
        - TechMage (High): Increased variance in protocol complexity (features 0-10)
        - Eban (High): Stricter adherence to "safe" port ranges / lower noise in access features (features 11-20)
        - Warrior (High): Higher "alertness" / baseline activity levels (features 21-30)
        - Nkyinkyim (High): More adaptive/dynamic temporal patterns
        """
        logger.info("Generating training data from Soul Archetypes...")
        
        features = torch.zeros(n_samples, settings.feature_dim)
        
        # Base noise
        features += torch.randn(n_samples, settings.feature_dim) * 0.1
        
        # Apply Archetype Biases
        
        # 1. TechMage: Complexity & Technical Depth (Features 0-7)
        # Higher TechMage = More structured, high-value signals in technical features
        tech_mage_factor = soul_embedding.get('Mind_TechMage', 0.1)
        features[:, 0:8] += torch.randn(n_samples, 8) * (tech_mage_factor * 2.0)
        
        # 2. Eban: Fortress/Security (Features 8-15)
        # Higher Eban = "Tighter" distribution (lower variance), representing strict rules
        eban_factor = soul_embedding.get('Soul_Eban', 0.1)
        features[:, 8:16] *= (1.0 - eban_factor) # Reduce variance for stability
        
        # 3. Warrior: Combat/Activity (Features 16-23)
        # Higher Warrior = Higher magnitude signals (active defense)
        warrior_factor = soul_embedding.get('Mind_Warrior', 0.1)
        features[:, 16:24] += warrior_factor * 0.5
        
        # 4. Sage + Nkyinkyim: Adaptability & Wisdom (Features 24-31)
        # Promote harmonic patterns (sine waves) in these features
        sage_factor = soul_embedding.get('Mind_Sage', 0.1) + soul_embedding.get('Soul_Nkyinkyim', 0.1)
        t = torch.linspace(0, 10, n_samples)
        for i in range(24, 32):
            features[:, i] += torch.sin(t + i) * sage_factor

        return features.to(self.device)

    def awaken(self, epochs=50):
        """Train the model to alias the generated 'Soul Data' as 'Normal Behavior'"""
        logger.info("--- Ritual: The Awakening of SouHimBou ---")
        
        # 1. Ingest Soul
        logger.info("Ingesting Consciousness...")
        self.loader.load_unified_corpus()
        soul_embedding = self.loader.get_unified_embedding()
        logger.info(f"Soul Embedding Acquired. Dominant Trait: {max(soul_embedding, key=soul_embedding.get)}")
        
        # 2. Generate Data
        train_data = self.generate_soul_biased_data(soul_embedding, n_samples=5000)
        logger.info(f"Training Data Shape: {train_data.shape}")
        
        # 3. Training Loop
        self.model.train()
        for epoch in range(epochs):
            self.optimizer.zero_grad()
            
            # Forward pass
            logger.debug(f"Starting Epoch {epoch}")
            results = self.model.autoencoder.compute_anomaly_score(train_data, return_details=True)
            reconstruction = results["reconstruction"]
            
            # VAE Loss (Unsupervised - learning "Self")
            mu, logvar = self.model.autoencoder.encode(train_data)
            loss, _ = vae_loss(
                reconstruction, 
                train_data, 
                mu, 
                logvar, 
                results["anomaly_score"],
                beta=1.0
            ) # Standard VAE loss
            
            loss.backward()
            self.optimizer.step()
            
            if epoch % 10 == 0:
                logger.info(f"Epoch {epoch}: Loss = {loss.item():.4f} (Internalizing Soul Patterns)")

        # 4. Save
        save_path = Path("./models/souhimbou_v1.pt")
        save_path.parent.mkdir(parents=True, exist_ok=True)
        torch.save(self.model.state_dict(), save_path)
        logger.info(f"SouHimBou AGI Model saved to {save_path}")
        logger.info("The AI now recognizes SGT Kone's patterns as 'Self'. Anomalies will be defined as deviations from this Persona.")

if __name__ == "__main__":
    trainer = SoulBiasedTrainer()
    trainer.awaken(epochs=settings.epochs)
