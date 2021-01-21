pipeline{
    
    agent any
    
    stages{
        
        stage('Checkout Resource'){
            
            
            steps{
                
                git url: 'https://github.com/Gurkiran-Singh/LambdaTest.git'
            }
            
            
        }
        
        stage('Deploy'){
            
            steps{
               
                sh 'npm install'
                sh 'npm install serverless-deployment-bucket'
                sh 'npm install serverless-custom-buckets'
                sh 'npm install serverless-plugin-ifelse'
                sh 'serverless deploy'
            }
        }
    }
    
}
