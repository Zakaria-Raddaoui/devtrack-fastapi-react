# Dockerfile for React Application

FROM node:14

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application code
COPY . .

# Build the application
RUN npm run build

# Install serve to serve the application
RUN npm install -g serve

# Command to run the application
CMD ["serve", "-s", "build"]

# The application will be available on port 3000
EXPOSE 3000
