import { Sequelize } from 'sequelize';

// Use environment variable DATABASE_URL or fallback to local MySQL settings
const sequelize = new Sequelize(process.env.DATABASE_URL || 'mysql://root:Kishore%40123@localhost:3306/smartdoc_ai_localhost', {
    logging: false,
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log(`📦 MySQL Database Connected to ${sequelize.config.host}`);

        // Sync models (creates tables if they don't exist)
        await sequelize.sync({ alter: true });
        console.log(`📦 MySQL Tables Synced successfully!`);
    } catch (error) {
        console.error(`🚨 MySQL Connection Error: ${error.message}`);
        console.warn(`[WARNING] Ensure MySQL Workbench/XAMPP is running and database 'smartdoc_ai' is created.`);
    }
};

export { sequelize };
export default connectDB;
