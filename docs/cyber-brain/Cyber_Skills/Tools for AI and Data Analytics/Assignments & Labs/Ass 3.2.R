# Enhanced Fitness Data Analysis Script
install.packages("tidyverse")
install.packages("ggplot2")
install.packages("lubridate")
install.packages("dplyr")
install.packages("readr")

library(ggplot2)
library(dplyr)
library(lubridate)
library(tidyverse)


# Load required packages
if (!require("pacman")) install.packages("pacman")
pacman::p_load(tidyverse, ggplot2, lubridate, factoextra, gridExtra, corrplot)

# Set the working directory
tryCatch({
  setwd("C:/Users/Laptop218/OneDrive - University at Albany - SUNY/Documents/MSDF/Tools for AI and Data Analytics/Dataset")
  cat("Working directory set to:", getwd(), "\n")
}, error = function(e) {
  stop("Error setting working directory. Please check the path and permissions.")
})
# Load data
dailyActivity_merged <- read_csv("dailyActivity_merged.csv")
hourlyIntensities_merged <- read_csv("hourlyIntensities_merged.csv")

# Data Preprocessing
dailyActivity_merged <- dailyActivity_merged %>%
  mutate(
    Date = as.Date(ActivityDate, format = "%m/%d/%Y"),
    SedentaryMinutes = TotalMinutes - (VeryActiveMinutes + FairlyActiveMinutes + LightlyActiveMinutes)
  ) %>%
  select(-ActivityDate, -TotalMinutes)

hourlyIntensities_merged <- hourlyIntensities_merged %>%
  mutate(DateTime = as.POSIXct(paste(ActivityHour), format = "%m/%d/%Y %I:%M:%S %p"))

# Question 1: Multiple Regression Analysis
regression_model <- lm(Calories ~ SedentaryMinutes + VeryActiveMinutes + LightlyActiveMinutes + FairlyActiveMinutes, data = dailyActivity_merged)

# Diagnostic plots
plot_list <- list(
  ggplot(regression_model, aes(.fitted, .resid)) +
    geom_point() +
    geom_hline(yintercept = 0, linetype = "dashed") +
    geom_smooth(se = FALSE) +
    labs(title = "Residuals vs Fitted"),
  
  ggplot(regression_model, aes(sample = .stdresid)) +
    stat_qq() +
    stat_qq_line() +
    labs(title = "Normal Q-Q Plot"),
  
  ggplot(regression_model, aes(.fitted, sqrt(abs(.stdresid)))) +
    geom_point() +
    geom_smooth(se = FALSE) +
    labs(title = "Scale-Location Plot"),
  
  ggplot(regression_model, aes(.hat, .stdresid)) +
    geom_point() +
    geom_smooth(se = FALSE) +
    labs(title = "Residuals vs Leverage")
)

grid.arrange(grobs = plot_list, ncol = 2)

# Model summary
summary_stats <- summary(regression_model)
cat("\nRegression Model Summary:\n")
print(summary_stats)

# Question 2: K-means Clustering
# Check for missing values
if (anyNA(hourlyIntensities_merged)) {
  hourlyIntensities_merged <- na.omit(hourlyIntensities_merged)
  warning("Missing values removed from the dataset.")
}

# Scale data
scaled_data <- scale(hourlyIntensities_merged[, c("TotalIntensity", "AverageIntensity")])

# Determine optimal number of clusters
set.seed(123)  # for reproducibility
fviz_nbclust(scaled_data, kmeans, method = "wss") +
  labs(title = "Elbow Method for Optimal k")

fviz_nbclust(scaled_data, kmeans, method = "silhouette") +
  labs(title = "Silhouette Method for Optimal k")

# Perform k-means clustering with optimal k
optimal_k <- 3  # Replace with the optimal number you determined
k_means_result <- kmeans(scaled_data, centers = optimal_k, nstart = 25)

# Visualize clusters
fviz_cluster(k_means_result, data = scaled_data, 
             geom = "point",
             ellipse.type = "convex", 
             ggtheme = theme_minimal()) +
  labs(title = "K-means Clustering Result")

# Interpret clusters
cluster_summary <- hourlyIntensities_merged %>%
  mutate(Cluster = as.factor(k_means_result$cluster)) %>%
  group_by(Cluster) %>%
  summarize(
    Mean_TotalIntensity = mean(TotalIntensity),
    Mean_AverageIntensity = mean(AverageIntensity),
    Count = n()
  )

print(cluster_summary)

# Visualize cluster characteristics
ggplot(cluster_summary, aes(x = Mean_TotalIntensity, y = Mean_AverageIntensity, size = Count, color = Cluster)) +
  geom_point(alpha = 0.7) +
  scale_size_continuous(range = c(5, 15)) +
  theme_minimal() +
  labs(title = "Cluster Characteristics",
       x = "Mean Total Intensity",
       y = "Mean Average Intensity")

# Additional Analysis: Time-based patterns
hourly_patterns <- hourlyIntensities_merged %>%
  mutate(
    Hour = hour(DateTime),
    Weekday = wday(DateTime, label = TRUE)
  ) %>%
  group_by(Hour, Weekday) %>%
  summarize(AvgIntensity = mean(TotalIntensity))

ggplot(hourly_patterns, aes(x = Hour, y = AvgIntensity, color = Weekday)) +
  geom_line() +
  facet_wrap(~Weekday) +
  theme_minimal() +
  labs(title = "Average Intensity by Hour and Day of Week",
       x = "Hour of Day",
       y = "Average Intensity")

# Correlation analysis
correlation_matrix <- cor(dailyActivity_merged[, c("Calories", "SedentaryMinutes", "VeryActiveMinutes", "FairlyActiveMinutes", "LightlyActiveMinutes")])
corrplot(correlation_matrix, method = "color", type = "upper", order = "hclust", 
         tl.col = "black", tl.srt = 45, addCoef.col = "black")