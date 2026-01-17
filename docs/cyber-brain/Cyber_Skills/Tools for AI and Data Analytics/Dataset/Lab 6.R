
# Updated Fitbit Data K-means Clustering Analysis

# Fitbit Data K-means Clustering Analysis

# Load required packages
install.packages("tidyverse")
install.packages("ggplot2")
install.packages("lubridate")
install.packages("dplyr")
install.packages("readr")

# Install required packages if not already installed
if (!require("pacman")) install.packages("pacman")
pacman::p_load(tidyverse, lubridate, cluster, factoextra)

# Load required libraries
library(tidyverse)
library(lubridate)
library(cluster)
library(factoextra)
library(readr)
library(pacman)

# Set the working directory
tryCatch({
  setwd("C:\\Users\\Laptop218\\OneDrive - SecRed Knowledge Inc\\MSDF\\Tools for AI & Data Analytics\\Dataset")
  cat("Working directory set to:", getwd(), "\n")
}, error = function(e) {
  stop("Error setting working directory. Please check the path and permissions.")
})

# Task 1: Activity Clustering

# Load data
daily_activity <- read_csv("dailyActivity_merged.csv")

# 1. Prepare activity data
activity_data <- daily_activity %>%
  mutate(Date = as.Date(ActivityDate, format = "%m/%d/%Y")) %>%
  select(Id, Date, Calories, TotalSteps, VeryActiveMinutes)

# 2. Scale the data
scaled_data <- activity_data %>%
  select(Calories, TotalSteps, VeryActiveMinutes) %>%
  scale()

# 3. Perform K-means clustering
set.seed(123)
k <- 3  # You can adjust this or use methods to determine optimal k
km_result <- kmeans(scaled_data, centers = k)

# 4. Add cluster assignments to the data
activity_data$Cluster <- as.factor(km_result$cluster)

# 5. Visualize clusters
ggplot(activity_data, aes(x = Calories, y = TotalSteps, color = Cluster)) +
  geom_point(alpha = 0.7) +
  theme_minimal() +
  labs(title = "User Clusters based on Activity",
       x = "Calories Burnt",
       y = "Total Steps")

# Task 2: Sleep Data Clustering

# Load sleep data
sleep_data <- read_csv("minuteSleep_merged.csv")

# 1. Prepare sleep data
sleep_aggregated <- sleep_data %>%
  mutate(Date = as.Date(date)) %>%
  group_by(Id, Date) %>%
  summarize(
    TotalSleepMinutes = n(),  # Each row represents one minute of sleep
    SleepEfficiency = sum(value) / n()  # Assuming 'value' represents sleep quality
  ) %>%
  ungroup()

# 2. Select relevant columns for clustering
sleep_cluster_data <- sleep_aggregated %>%
  select(TotalSleepMinutes, SleepEfficiency)

# 3. Normalize the data
sleep_normalized <- scale(sleep_cluster_data)

# 4. Perform k-means clustering
set.seed(123)
k_sleep <- 3  # You can adjust this or use methods to determine optimal k
km_sleep <- kmeans(sleep_normalized, centers = k_sleep)

# 5. Add cluster assignments to the original data
sleep_aggregated$Cluster <- as.factor(km_sleep$cluster)

# 6. Visualize and interpret the clusters
ggplot(sleep_aggregated, aes(x = TotalSleepMinutes, y = SleepEfficiency, color = Cluster)) +
  geom_point(alpha = 0.7) +
  theme_minimal() +
  labs(title = "Sleep Clusters",
       x = "Total Sleep Minutes",
       y = "Sleep Efficiency")