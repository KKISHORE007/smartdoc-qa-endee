import { DataTypes } from 'sequelize';
import { sequelize } from '../config/db.js';

const History = sequelize.define('History', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    chatMode: {
        type: DataTypes.STRING,
        allowNull: false, // 'online' or 'offline'
        defaultValue: 'online'
    },
    docId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    docName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    docSize: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    docType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    readPreview: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    localDocText: {
        type: DataTypes.TEXT('long'),
        allowNull: true
    },
    messages: {
        type: DataTypes.JSON, // Stores the array of chat messages
        allowNull: false,
        defaultValue: []
    }
}, {
    timestamps: true,
    tableName: 'Histories'
});

export default History;
