"""
Adinkhepra ML Anomaly Detection Models
"The Mind of Thoth Perceives the Hidden"

This module implements the PyTorch neural network models for behavioral
anomaly detection. It uses an autoencoder-based approach with attention
mechanisms for feature importance.
"""
import torch
import torch.nn as nn
import torch.nn.functional as F
from typing import Tuple, Dict, Optional
import numpy as np


class FeatureAttention(nn.Module):
    """Attention mechanism to learn feature importance for anomaly detection"""

    def __init__(self, feature_dim: int, hidden_dim: int):
        super().__init__()
        self.query = nn.Linear(feature_dim, hidden_dim)
        self.key = nn.Linear(feature_dim, hidden_dim)
        self.value = nn.Linear(feature_dim, hidden_dim)
        self.output = nn.Linear(hidden_dim, feature_dim)
        self.scale = hidden_dim ** 0.5

    def forward(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """
        Args:
            x: Input tensor of shape (batch_size, feature_dim)
        Returns:
            attended_features: Attended feature tensor (batch_size, feature_dim)
            attention_weights: Feature importance weights (batch_size, hidden_dim)
        """
        # Project to query, key, value spaces
        q = self.query(x)  # (batch_size, hidden_dim)
        k = self.key(x)    # (batch_size, hidden_dim)
        v = self.value(x)  # (batch_size, hidden_dim)

        # Compute attention scores per feature dimension (element-wise scaled dot product)
        # This creates feature importance weights
        attention_scores = (q * k) / self.scale  # (batch_size, hidden_dim)
        attention_weights = F.softmax(attention_scores, dim=-1)  # (batch_size, hidden_dim)

        # Apply attention weights to values
        attended = attention_weights * v  # (batch_size, hidden_dim)

        # Project back to feature space
        output = self.output(attended)  # (batch_size, feature_dim)

        return output, attention_weights


class AnomalyAutoencoder(nn.Module):
    """
    Variational Autoencoder for anomaly detection.
    Learns to reconstruct normal request patterns - high reconstruction
    error indicates anomalous behavior.
    """

    def __init__(
        self,
        feature_dim: int = 32,
        hidden_dim: int = 64,
        latent_dim: int = 16
    ):
        super().__init__()
        self.feature_dim = feature_dim
        self.hidden_dim = hidden_dim
        self.latent_dim = latent_dim

        # Feature attention layer
        self.attention = FeatureAttention(feature_dim, hidden_dim)

        # Encoder
        self.encoder = nn.Sequential(
            nn.Linear(feature_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
        )

        # VAE latent layers
        self.fc_mu = nn.Linear(hidden_dim, latent_dim)
        self.fc_logvar = nn.Linear(hidden_dim, latent_dim)

        # Decoder
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, hidden_dim),
            nn.LayerNorm(hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, feature_dim),
        )

        # Anomaly classification head
        self.classifier = nn.Sequential(
            nn.Linear(latent_dim + feature_dim, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(hidden_dim, 1),
            nn.Sigmoid(),
        )

    def encode(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Encode input to latent distribution parameters"""
        # Apply attention
        attended, _ = self.attention(x)
        x = x + attended  # Residual connection

        # Encode
        h = self.encoder(x)
        mu = self.fc_mu(h)
        logvar = self.fc_logvar(h)
        return mu, logvar

    def reparameterize(self, mu: torch.Tensor, logvar: torch.Tensor) -> torch.Tensor:
        """Reparameterization trick for VAE"""
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def decode(self, z: torch.Tensor) -> torch.Tensor:
        """Decode latent representation to reconstruction"""
        return self.decoder(z)

    def forward(
        self, x: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """
        Forward pass through the autoencoder.

        Args:
            x: Input features (batch_size, feature_dim)

        Returns:
            reconstruction: Reconstructed input
            mu: Latent mean
            logvar: Latent log variance
            anomaly_score: Predicted anomaly probability
        """
        # Encode
        mu, logvar = self.encode(x)

        # Sample latent
        z = self.reparameterize(mu, logvar)

        # Decode
        reconstruction = self.decode(z)

        # Classify anomaly
        classifier_input = torch.cat([z, x], dim=-1)
        anomaly_score = self.classifier(classifier_input)

        return reconstruction, mu, logvar, anomaly_score.squeeze(-1)

    def compute_anomaly_score(
        self, x: torch.Tensor, return_details: bool = False
    ) -> Dict[str, torch.Tensor]:
        """
        Compute anomaly score for input features.

        The score combines:
        1. Reconstruction error (MSE)
        2. KL divergence from standard normal
        3. Classification head output

        Args:
            x: Input features (batch_size, feature_dim)
            return_details: If True, return detailed breakdown

        Returns:
            Dictionary with anomaly scores and optional details
        """
        with torch.no_grad():
            reconstruction, mu, logvar, class_score = self.forward(x)

            # Reconstruction error
            recon_error = F.mse_loss(reconstruction, x, reduction='none').mean(dim=-1)

            # KL divergence
            kl_div = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp(), dim=-1)

            # Normalize components
            recon_normalized = torch.sigmoid(recon_error * 5)  # Scale factor
            kl_normalized = torch.sigmoid(kl_div * 0.1)  # Scale factor

            # Combined score (weighted average)
            combined_score = (
                0.4 * recon_normalized +
                0.2 * kl_normalized +
                0.4 * class_score
            )

            result = {"anomaly_score": combined_score}

            if return_details:
                result.update({
                    "reconstruction_error": recon_error,
                    "kl_divergence": kl_div,
                    "classifier_score": class_score,
                    "reconstruction": reconstruction,
                })

            return result

    def get_feature_importance(self, x: torch.Tensor) -> torch.Tensor:
        """Get attention-based feature importance scores"""
        with torch.no_grad():
            _, attention_weights = self.attention(x)
            return attention_weights


class IsolationForestTorch(nn.Module):
    """
    PyTorch-compatible Isolation Forest for ensemble anomaly detection.
    This is a differentiable approximation for hybrid training.
    """

    def __init__(
        self,
        feature_dim: int,
        n_estimators: int = 100,
        max_depth: int = 8
    ):
        super().__init__()
        self.feature_dim = feature_dim
        self.n_estimators = n_estimators
        self.max_depth = max_depth

        # Learnable split thresholds for each tree level
        self.split_thresholds = nn.ParameterList([
            nn.Parameter(torch.randn(n_estimators, feature_dim) * 0.1)
            for _ in range(max_depth)
        ])

        # Feature selection weights
        self.feature_weights = nn.Parameter(torch.randn(n_estimators, feature_dim))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Compute path length approximation for anomaly scoring.

        Args:
            x: Input features (batch_size, feature_dim)

        Returns:
            Anomaly scores (batch_size,)
        """
        batch_size = x.shape[0]

        # Initialize path lengths
        path_lengths = torch.zeros(batch_size, self.n_estimators, device=x.device)

        # Simulate tree traversal with soft decisions
        for depth, thresholds in enumerate(self.split_thresholds):
            # Soft split decision
            feature_probs = F.softmax(self.feature_weights, dim=-1)
            weighted_features = torch.einsum('bd,ed->be', x, feature_probs)

            # Decision: compare with threshold
            decisions = torch.sigmoid(weighted_features - thresholds.mean(dim=-1))

            # Accumulate path length contribution
            path_lengths += decisions * (self.max_depth - depth) / self.max_depth

        # Average over estimators and normalize
        avg_path_length = path_lengths.mean(dim=-1)
        anomaly_score = 1 - (avg_path_length / self.max_depth)

        return anomaly_score


class EnsembleAnomalyDetector(nn.Module):
    """
    Ensemble model combining multiple anomaly detection approaches.
    """

    def __init__(
        self,
        feature_dim: int = 32,
        hidden_dim: int = 64,
        latent_dim: int = 16
    ):
        super().__init__()

        # Autoencoder component
        self.autoencoder = AnomalyAutoencoder(feature_dim, hidden_dim, latent_dim)

        # Isolation Forest component
        self.isolation_forest = IsolationForestTorch(feature_dim)

        # Ensemble weights (learnable)
        self.ensemble_weights = nn.Parameter(torch.tensor([0.6, 0.4]))

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Compute ensemble anomaly score.

        Args:
            x: Input features (batch_size, feature_dim)

        Returns:
            Dictionary with ensemble score and component scores
        """
        # Get autoencoder scores
        ae_results = self.autoencoder.compute_anomaly_score(x, return_details=True)
        ae_score = ae_results["anomaly_score"]

        # Get isolation forest scores
        if_score = self.isolation_forest(x)

        # Ensemble combination
        weights = F.softmax(self.ensemble_weights, dim=0)
        ensemble_score = weights[0] * ae_score + weights[1] * if_score

        return {
            "anomaly_score": ensemble_score,
            "autoencoder_score": ae_score,
            "isolation_forest_score": if_score,
            "reconstruction_error": ae_results["reconstruction_error"],
            "confidence": 1 - torch.abs(ae_score - if_score),
        }


def vae_loss(
    reconstruction: torch.Tensor,
    x: torch.Tensor,
    mu: torch.Tensor,
    logvar: torch.Tensor,
    anomaly_score: torch.Tensor,
    anomaly_labels: Optional[torch.Tensor] = None,
    beta: float = 1.0
) -> Tuple[torch.Tensor, Dict[str, float]]:
    """
    Compute VAE loss with optional supervised anomaly component.

    Args:
        reconstruction: Reconstructed input
        x: Original input
        mu: Latent mean
        logvar: Latent log variance
        anomaly_score: Predicted anomaly score
        anomaly_labels: Optional ground truth labels (1=anomaly, 0=normal)
        beta: KL divergence weight

    Returns:
        Total loss and breakdown dictionary
    """
    # Reconstruction loss
    recon_loss = F.mse_loss(reconstruction, x, reduction='mean')

    # KL divergence
    kl_loss = -0.5 * torch.mean(1 + logvar - mu.pow(2) - logvar.exp())

    # Classification loss (if labels provided)
    if anomaly_labels is not None:
        class_loss = F.binary_cross_entropy(anomaly_score, anomaly_labels.float())
    else:
        # Unsupervised: encourage low scores for all (assume mostly normal)
        class_loss = anomaly_score.mean()

    # Total loss
    total_loss = recon_loss + beta * kl_loss + 0.5 * class_loss

    return total_loss, {
        "reconstruction_loss": recon_loss.item(),
        "kl_loss": kl_loss.item(),
        "classification_loss": class_loss.item(),
        "total_loss": total_loss.item(),
    }
