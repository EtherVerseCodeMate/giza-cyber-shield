library(tidyverse)
library(dplyr)
library(ggplot2)
library(tidyr)
#loaddataset
customerpurchasing <- read.csv("CustomerPurchasingBehaviors.csv")

#examine data
str(customerpurchasing)
head(customerpurchasing)

#convert region to factor as it is a categorical variable
customerpurchasing$region <- as.factor(customerpurchasing$region)

#cleaning data/checking for missing values/duplicates
colSums(is.na(customerpurchasing))

#no missing values
duplicates <- customerpurchasing[duplicated(customerpurchasing), ]
print(duplicates)
#no duplicates found

#verifying column types
str(customerpurchasing)

#changing region names for consistency (lowercase)
customerpurchasing$region <- tolower(customerpurchasing$region)  #converting to lowercase for consistency throughout
customerpurchasing$region <- factor(customerpurchasing$region)   #re-factoring to clean levels

#final cleaned data check
head(customerpurchasing)
summary(customerpurchasing) #statistics

#our research question:How can we evaluate our customer purchasing behaviors to improve our marketing strategy and better serve our stakeholders? 

##########Step 1:Customer Segmentation. Goal - identify which age groups contribute the most revenue/have higher loyalty#########

#create age groups: young (18-30), middle-Aged (31-50), older (50+)
customerpurchasing$age_group <- cut(
  customerpurchasing$age,
  breaks = c(0, 30, 50, Inf),  # Define age ranges
  labels = c("Young", "Middle-Aged", "Older"),  
  right = FALSE  # Include lower bound, exclude upper bound
)
table(customerpurchasing$age_group)

#summarize metrics by age group
age_group_summary <- customerpurchasing %>%
  group_by(age_group) %>%
  summarise(
    avg_income = mean(annual_income),
    avg_purchase = mean(purchase_amount),
    avg_loyalty = mean(loyalty_score),
    customer_count = n()
  )
print(age_group_summary)


#bar chart for average purchase amount by age group
ggplot(age_group_summary, aes(x = age_group, y = avg_purchase, fill = age_group)) +
  geom_bar(stat = "identity") +
  ggtitle("Average Purchase Amount by Age Group") +
  ylab("Average Purchase Amount") +
  xlab("Age Group") +
  theme_minimal()

#bar chart for average income by age group
ggplot(age_group_summary, aes(x = age_group, y = avg_income, fill = age_group)) +
  geom_bar(stat = "identity") +
  ggtitle("Average Income by Age Group") +
  ylab("Average Income") +
  xlab("Age Group") +
  theme_minimal()

##OBSERVATIONS:
#1. Income Increases with Age:
#Younger customers have the lowest average income ($40,804), while older customers have the highest ($72,023).
#This is consistent with life stages—people tend to earn more as they gain experience and seniority in the workforce.
#2. Spending Increases with Age:
#Older customers spend almost three times more ($613) than young customers ($219).
#Middle-aged customers are in between, spending $441 on average.
#3. Loyalty Score Correlates with Age:
#Older customers are also the most loyal (average loyalty score = 9.19), suggesting more frequent purchases or brand attachment.
#Younger customers show lower loyalty (score = 3.95), indicating they may need more incentives to remain engaged with the business.
#4. Customer Distribution:
#The largest segment is middle-aged customers (143 people), making this group a key target for marketing campaigns.


##recommendations for our marketing strategy for ABC Sales Inc based on age groups and income:
#Young Customers (0-30):
#Goal: Increase loyalty and spending.
#Strategy: Use discounts, gamification, and targeted promotions (like student offers) to drive engagement.

#Middle-Aged Customers (31-50):
#Goal: Maintain and strengthen engagement since they are the largest segment.
#Strategy: Offer personalized product recommendations and loyalty rewards programs to increase brand affinity.

#Older Customers (50+):
#Goal: Leverage their high spending and loyalty.
#Strategy: Focus on premium products or exclusive offers, as this group tends to spend more and stick to brands they trust.

#another visualization (just previous bar graphs combined - not needed but nice to have for the powerpoint/presentation)
#reshape data using pivotlonger for plotting combined visualization of income and purchase amount by age group
age_group_long <- age_group_summary %>%
  pivot_longer(
    cols = c(avg_income, avg_purchase),
    names_to = "variable",
    values_to = "value"
  )
ggplot(age_group_long, aes(x = age_group, y = value, fill = variable)) +
  geom_bar(stat = "identity", position = "dodge") +
  facet_wrap(~ variable, scales = "free_y") +
  ggtitle("Income and Purchase Amount by Age Group") +
  ylab("Amount") +
  xlab("Age Group") +
  theme_minimal()



##########Step 2:Customer Personas & Behavior Patterns. Goal:Identify personas of customers; "High Spend, Low Frequency" or "Frequent, Loyal Buyers."#########
#this is building upon step one to gain further insight on the data. there may be possible hidden factors we did not take int account in step1.
#prepare data for clustering:selecting relevant numeric columns for clustering
numeric_data <- customerpurchasing %>%
  select(annual_income, purchase_amount, loyalty_score)
head(numeric_data)

#scaling
numeric_data_scaled <- scale(numeric_data)

#k-means clustering (3 clusters)
set.seed(123) 
clusters <- kmeans(numeric_data_scaled, centers = 3)
#adding cluster labels to original dataset
customerpurchasing$cluster <- as.factor(clusters$cluster)

#create plot to visualize
ggplot(customerpurchasing, aes(x = annual_income, y = purchase_amount, color = cluster)) +
  geom_point() +
  ggtitle("Customer Clusters based on Income and Purchase Amount") +
  xlab("Annual Income") +
  ylab("Purchase Amount") +
  theme_minimal()

#cluster summary
# Summarize each cluster to understand their behaviors
cluster_summary <- customerpurchasing %>%
  group_by(cluster) %>%
  summarise(
    avg_income = mean(annual_income),
    avg_purchase = mean(purchase_amount),
    avg_loyalty = mean(loyalty_score),
    customer_count = n()
  )
print(cluster_summary)

#cross-tabulate age groups with clusters for further insights
table(customerpurchasing$age_group, customerpurchasing$cluster)


#OBSERVATIONS:
#Cluster 1 (Red):
#High Income (above ~55K) and High Purchase Amount (~500+)
#represents possible premium customers with both the income and willingness to spend.
#Marketing Strategy: Offer exclusive deals, premium products, or VIP programs.
#Cluster 2 (Green):
#Low Income (~30K–40K) and Low Purchase Amount (~200)
#represents possible price-sensitive customers who spend conservatively.
#Marketing Strategy: Provide discounts, loyalty points, and seasonal promotions to boost purchases.
#Cluster 3 (Blue):
#Mid-Income (~45K–55K) and Moderate Purchase Amount (~300–400)
#These customers sit between high- and low-value groups, with moderate spending habits.
#Marketing Strategy: Use personalized offers and cross-selling strategies to encourage them to increase spending.


#crose-tabulate age groups with clusters interpretation:
#young Customers (0-30 years):
#All 51 young customers belong to Cluster 2 (low income, low purchases).
#Young customers seem to be price-sensitive. They likely have less disposable income and might require discounts or student-focused offers.
#Middle-Aged Customers (31-50 years):
#This group is split across all three clusters:
#Cluster 1 (High Income, High Purchases): 39 customers
#Cluster 2 (Low Income, Low Purchases): 8 customers
#Cluster 3 (Mid Income, Moderate Purchases): 96 customers
#Insight: The middle-aged group is diverse—some are high spenders, while others are more moderate or price-sensitive.
#Focus on personalized offers for this group, as it is the largest and most varied segment.
#Older Customers (50+ years):
#All 44 older customers belong to Cluster 1 (high income, high purchases).
#Insight: Older customers are the most valuable—they earn the most and spend the most. Marketing efforts should focus on exclusive offers, luxury products, or loyalty programs to retain them.






