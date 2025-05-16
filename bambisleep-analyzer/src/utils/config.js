/**
 * Configuration Management Utility
 * Responsible for loading and accessing configuration settings 
 * based on the current environment.
 */
import configModule from 'config';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
dotenv.config();

// Get the directory name of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Config class for managing application configuration
 * @class Config
 */
class Config {
  constructor() {
    this.config = null;
    this.init();
  }

  /**
   * Initialize the configuration
   * @private
   */  init() {
    const env = process.env.NODE_ENV || 'development';
    const configDir = path.resolve(__dirname, '../../config');
    
    // Load default configuration
    const defaultConfigPath = path.join(configDir, 'default.js');
    const defaultConfig = this.loadConfigFile(defaultConfigPath);
    
    // Load environment-specific configuration
    const envConfigPath = path.join(configDir, `${env}.js`);
    const envConfig = fs.existsSync(envConfigPath) 
      ? this.loadConfigFile(envConfigPath) 
      : {};
    
    // Merge configurations with environment variables
    this.config = this.mergeWithEnv(this.deepMerge(defaultConfig, envConfig));
    
    // If loading our files failed, fall back to 'config' module
    if (!this.config || Object.keys(this.config).length === 0) {
      this.config = configModule;
    }
  }

  /**
   * Load a configuration file
   * @param {string} filePath - Path to the configuration file
   * @returns {Object} The configuration object
   * @private
   */
  loadConfigFile(filePath) {
    try {
      return import(filePath).then(module => module.default);
    } catch (error) {
      console.error(`Error loading config file: ${filePath}`, error);
      return {};
    }
  }

  /**
   * Deep merge two objects
   * @param {Object} target - Target object
   * @param {Object} source - Source object to merge
   * @returns {Object} Merged object
   * @private
   */
  deepMerge(target, source) {
    const output = { ...target };
    
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  }

  /**
   * Check if value is an object
   * @param {*} item - Item to check
   * @returns {boolean} True if item is an object
   * @private
   */
  isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
  }

  /**
   * Override configuration with environment variables
   * @param {Object} config - Configuration object
   * @returns {Object} Configuration with environment variables applied
   * @private
   */
  mergeWithEnv(config) {
    const result = { ...config };
    
    // Process environment variables and override config
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('MCP_')) {
        const configPath = key
          .substring(4)
          .toLowerCase()
          .split('_');
        
        let current = result;
        const lastKey = configPath.pop();
        
        configPath.forEach(segment => {
          if (!current[segment]) {
            current[segment] = {};
          }
          current = current[segment];
        });
        
        current[lastKey] = this.parseEnvValue(process.env[key]);
      }
    });
    
    return result;
  }

  /**
   * Parse environment variable value to appropriate type
   * @param {string} value - Environment variable value
   * @returns {*} Parsed value
   * @private
   */
  parseEnvValue(value) {
    // Try to parse as JSON
    try {
      return JSON.parse(value);
    } catch (e) {
      // If it's not valid JSON, return as is
      return value;
    }
  }

  /**
   * Get configuration value by path
   * @param {string} path - Dot-notation path to configuration value
   * @param {*} defaultValue - Default value if path not found
   * @returns {*} Configuration value
   */
  get(path, defaultValue = undefined) {
    const parts = path.split('.');
    let current = this.config;
    
    for (const part of parts) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[part];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  /**
   * Get the entire configuration object
   * @returns {Object} The entire configuration
   */
  getAll() {
    return this.config;
  }
}

// Export a singleton instance
export default new Config();
