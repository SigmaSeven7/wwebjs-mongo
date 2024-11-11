// const fs = require('fs');

// class MongoStore {
//     constructor({ mongoose } = {}) {
//         if(!mongoose) throw new Error('A valid Mongoose instance is required for MongoStore.');
//         this.mongoose = mongoose;
//     }

//     async sessionExists(options) {
//         let multiDeviceCollection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
//         let hasExistingSession = await multiDeviceCollection.countDocuments();
//         return !!hasExistingSession;   
//     }
    
//     async save(options) {
//         var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
//             bucketName: `whatsapp-${options.session}`
//         });
//         await new Promise((resolve, reject) => {
//             fs.createReadStream(`${options.session}.zip`)
//                 .pipe(bucket.openUploadStream(`${options.session}.zip`))
//                 .on('error', err => reject(err))
//                 .on('close', () => resolve());
//         });
//         options.bucket = bucket;
//         await this.#deletePrevious(options);
//     }

//     async extract(options) {
//         var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
//             bucketName: `whatsapp-${options.session}`
//         });
//         return new Promise((resolve, reject) => {
//             bucket.openDownloadStreamByName(`${options.session}.zip`)
//                 .pipe(fs.createWriteStream(options.path))
//                 .on('error', err => reject(err))
//                 .on('close', () => resolve());
//         });
//     }

//     async delete(options) {
//         var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
//             bucketName: `whatsapp-${options.session}`
//         });
//         const documents = await bucket.find({
//             filename: `${options.session}.zip`
//         }).toArray();

//         documents.map(async doc => {
//             return bucket.delete(doc._id);
//         });   
//     }

//     async #deletePrevious(options) {
//         const documents = await options.bucket.find({
//             filename: `${options.session}.zip`
//         }).toArray();
//         if (documents.length > 1) {
//             const oldSession = documents.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
//             return options.bucket.delete(oldSession._id);   
//         }
//     }
// }

// module.exports = MongoStore;

const fs = require('fs');

class MongoStore {
    constructor({ mongoose } = {}) {
        if(!mongoose) throw new Error('A valid Mongoose instance is required for MongoStore.');
        this.mongoose = mongoose;
    }

    async sessionExists(options) {
        let multiDeviceCollection = this.mongoose.connection.db.collection(`whatsapp-${options.session}.files`);
        let hasExistingSession = await multiDeviceCollection.countDocuments();
        return !!hasExistingSession;   
    }
    
    async save(options) {
        var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });
        await new Promise((resolve, reject) => {
            fs.createReadStream(`${options.session}.zip`)
                .pipe(bucket.openUploadStream(`${options.session}.zip`))
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });
        options.bucket = bucket;
        await this.#deletePrevious(options);
    }

    async extract(options) {
        var bucket = new this.mongoose.mongo.GridFSBucket(this.mongoose.connection.db, {
            bucketName: `whatsapp-${options.session}`
        });
        return new Promise((resolve, reject) => {
            bucket.openDownloadStreamByName(`${options.session}.zip`)
                .pipe(fs.createWriteStream(options.path))
                .on('error', err => reject(err))
                .on('close', () => resolve());
        });
    }

    async delete(options) {
        const db = this.mongoose.connection.db;
        const session = options.session;

        try {
            // Drop both collections used by GridFS
            await db.collection(`whatsapp-${session}.files`).drop().catch(() => {});
            await db.collection(`whatsapp-${session}.chunks`).drop().catch(() => {});

            // Alternative approach if drop doesn't work
            const bucket = new this.mongoose.mongo.GridFSBucket(db, {
                bucketName: `whatsapp-${session}`
            });

            // Get all files and delete them
            const files = await bucket.find({}).toArray();
            await Promise.all(files.map(file => 
                bucket.delete(file._id).catch(err => 
                    console.error(`Failed to delete file ${file._id}:`, err)
                )
            ));
        } catch (error) {
            console.error('Error during session deletion:', error);
            throw error;
        }
    }

    async #deletePrevious(options) {
        const documents = await options.bucket.find({
            filename: `${options.session}.zip`
        }).toArray();
        if (documents.length > 1) {
            const oldSession = documents.reduce((a, b) => a.uploadDate < b.uploadDate ? a : b);
            return options.bucket.delete(oldSession._id);   
        }
    }
}

module.exports = MongoStore;