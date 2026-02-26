import mongoose, { Document, Schema } from 'mongoose';

export interface IAppearance extends Document {
  project: 'ghadaq' | 'manasik';
  worksImages: {
    row1: string[];
    row2: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const AppearanceSchema = new Schema<IAppearance>(
  {
    project: {
      type: String,
      required: true,
      unique: true,
      index: true,
      enum: ['ghadaq', 'manasik'],
    },
    worksImages: {
      row1: { type: [String], default: [] },
      row2: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export default mongoose.models.Appearance ||
  mongoose.model<IAppearance>('Appearance', AppearanceSchema);
