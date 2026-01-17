# Load required packages
library(tidyverse)  # Load this first to ensure all dependencies are available
library(ggplot2)
library(dplyr)

# If you're still getting %>% errors, try loading magrittr explicitly
library(magrittr)

# Create scatter plots for each predictor without using pipes
predictors_data <- gather(daily_activity, 
                          key = "predictor", 
                          value = "value", 
                          SedentaryMinutes, VeryActiveMinutes, LightlyActiveMinutes)

predictors_plot <- ggplot(predictors_data, aes(x = value, y = Calories)) +
  geom_point(alpha = 0.5) +
  geom_smooth(method = "lm", se = TRUE) +
  facet_wrap(~predictor, scales = "free_x") +
  labs(title = "Relationship between Calories and Activity Minutes",
       x = "Minutes",
       y = "Calories Burned") +
  theme_minimal()

# Display the plot
print(predictors_plot)

# For K-means clustering
# First, let's check the structure of hourly_intensities
str(hourly_intensities)
print("Column names in hourly intensities:")
print(names(hourly_intensities))

# Select features for clustering without pipes
clustering_data <- scale(hourly_intensities[, c("TotalIntensity", "AverageIntensity")])

# Determine optimal number of clusters
set.seed(123)
wss <- numeric(10)
for (k in 1:10) {
  km <- kmeans(clustering_data, centers = k, nstart = 25)
  wss[k] <- km$tot.withinss
}

# Plot elbow curve
elbow_data <- data.frame(k = 1:10, wss = wss)
elbow_plot <- ggplot(elbow_data, aes(x = k, y = wss)) +
  geom_line() +
  geom_point() +
  labs(title = "Elbow Method for Optimal k",
       x = "Number of Clusters (k)",
       y = "Total Within Sum of Squares") +
  theme_minimal()

print(elbow_plot)

# Perform k-means clustering with optimal k (let's use k=3)
optimal_k <- 3
kmeans_result <- kmeans(clustering_data, centers = optimal_k, nstart = 25)

# Create basic cluster visualization
cluster_data <- data.frame(
  TotalIntensity = hourly_intensities$TotalIntensity,
  AverageIntensity = hourly_intensities$AverageIntensity,
  Cluster = as.factor(kmeans_result$cluster)
)

cluster_plot <- ggplot(cluster_data, aes(x = TotalIntensity, 
                                         y = AverageIntensity, 
                                         color = Cluster)) +
  geom_point(alpha = 0.6) +
  labs(title = "K-means Clustering of Activity Intensities") +
  theme_minimal()

print(cluster_plot)

# Calculate and print cluster statistics
cluster_centers <- as.data.frame(kmeans_result$centers)
colnames(cluster_centers) <- c("TotalIntensity", "AverageIntensity")
cluster_centers$Cluster <- 1:optimal_k

print("Cluster Centers:")
print(cluster_centers)

# Calculate size of each cluster
cluster_sizes <- table(kmeans_result$cluster)
print("\nCluster Sizes:")
print(cluster_sizes)