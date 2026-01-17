# Install and load required packages
#install.packages("tidyverse")
install.packages("factoextra")
# Load required libraries (assuming tidyverse is already installed)
library(ggplot2)
library(dplyr)
library(factoextra)
library(cluster)    # For cluster analysis
library(NbClust)    # For determining optimal number of clusters

# Install required packages

# Set working directory
setwd("C:\\Users\\Laptop218\\3D Objects\\Dataset")

# Load the daily activity dataset
daily_activity <- read.csv("dailyActivity_merged.csv")

# Question 1: Multiple Regression Analysis

# Load the daily activity dataset (assuming correct file path)
daily_activity <- read.csv("dailyActivity_merged.csv")

# Create sedentaryMinutes 
# Assuming you have 'TotalMinutes' and 'VeryActiveMinutes' columns
daily_activity$sedentaryMinutes <- daily_activity$TotalMinutes - daily_activity$VeryActiveMinutes


# Perform multiple regression analysis
regression_model <- lm(Calories ~ SedentaryMinutes + VeryActiveMinutes + LightlyActiveMinutes, data = dailyActivity_merged)

# Create diagnostic plots
par(mfrow = c(2, 2))
plot(regression_model)

# Interpret summary statistics
summary(regression_model)


print(regression_model)



# Load required libraries
library(tidyverse)
library(ggplot2)
library(dplyr)

# Check for missing values
if (anyNA(hourlyIntensities_merged)) {
  hourlyIntensities_merged <- na.omit(hourlyIntensities_merged)
  warning("Missing values removed from the dataset.")
}

# Scale the data
scaled_data <- scale(hourlyIntensities_merged[, c("TotalIntensity", "AverageIntensity")])

# Function to calculate total within-cluster sum of squares
calculate_wss <- function(data, max_k) {
  wss <- numeric(max_k)
  for (k in 1:max_k) {
    km <- kmeans(data, centers = k, nstart = 25)
    wss[k] <- km$tot.withinss
  }
  return(wss)
}

# Calculate WSS for different values of k
max_k <- 10
wss_values <- calculate_wss(scaled_data, max_k)

# Create elbow plot
elbow_data <- data.frame(k = 1:max_k, wss = wss_values)
elbow_plot <- ggplot(elbow_data, aes(x = k, y = wss)) +
  geom_line() +
  geom_point() +
  labs(title = "Elbow Method for Optimal k",
       x = "Number of Clusters (k)",
       y = "Total Within-cluster Sum of Squares") +
  theme_minimal()
print(elbow_plot)

# Function to calculate average silhouette width
calculate_silhouette <- function(data, max_k) {
  sil_width <- numeric(max_k - 1)
  for (k in 2:max_k) {
    km <- kmeans(data, centers = k, nstart = 25)
    ss <- cluster::silhouette(km$cluster, dist(data))
    sil_width[k-1] <- mean(ss[, 3])
  }
  return(sil_width)
}

# Calculate silhouette width for different values of k
sil_values <- calculate_silhouette(scaled_data, max_k)

# Create silhouette plot
silhouette_data <- data.frame(k = 2:max_k, sil_width = sil_values)
silhouette_plot <- ggplot(silhouette_data, aes(x = k, y = sil_width)) +
  geom_line() +
  geom_point() +
  labs(title = "Silhouette Analysis for Optimal k",
       x = "Number of Clusters (k)",
       y = "Average Silhouette Width") +
  theme_minimal()
print(silhouette_plot)

# Perform k-means with optimal k
optimal_k <- 3  # Adjust based on elbow and silhouette plots
final_kmeans <- kmeans(scaled_data, centers = optimal_k, nstart = 25)

# Create cluster visualization
cluster_data <- data.frame(
  TotalIntensity = hourlyIntensities_merged$TotalIntensity,
  AverageIntensity = hourlyIntensities_merged$AverageIntensity,
  Cluster = as.factor(final_kmeans$cluster)
)

cluster_plot <- ggplot(cluster_data, aes(x = TotalIntensity, y = AverageIntensity, color = Cluster)) +
  geom_point(alpha = 0.6) +
  geom_point(data = data.frame(
    TotalIntensity = final_kmeans$centers[, 1] * sd(hourlyIntensities_merged$TotalIntensity) + 
      mean(hourlyIntensities_merged$TotalIntensity),
    AverageIntensity = final_kmeans$centers[, 2] * sd(hourlyIntensities_merged$AverageIntensity) + 
      mean(hourlyIntensities_merged$AverageIntensity),
    Cluster = as.factor(1:optimal_k)
  ), size = 5, shape = 8) +
  labs(title = "K-means Clustering Results",
       x = "Total Intensity",
       y = "Average Intensity") +
  theme_minimal()
print(cluster_plot)

# Calculate cluster summaries
cluster_summary <- cluster_data %>%
  group_by(Cluster) %>%
  summarize(
    mean_TotalIntensity = mean(TotalIntensity),
    mean_AverageIntensity = mean(AverageIntensity),
    n = n()
  )
print(cluster_summary)

# Print additional cluster statistics
print("Cluster Statistics:")
print(paste("Total Sum of Squares:", round(final_kmeans$totss, 2)))
print(paste("Between Sum of Squares:", round(final_kmeans$betweenss, 2)))
print(paste("Within Sum of Squares:", round(final_kmeans$tot.withinss, 2)))
print(paste("Ratio of Between to Total SS (R-squared):", 
            round(final_kmeans$betweenss/final_kmeans$totss, 4)))