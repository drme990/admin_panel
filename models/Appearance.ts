import mongoose, { Document, Schema } from 'mongoose';

export interface IAppearance extends Document {
  worksImages: {
    row1: string[];
    row2: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const AppearanceSchema = new Schema<IAppearance>(
  {
    worksImages: {
      row1: { type: [String], default: [] },
      row2: { type: [String], default: [] },
    },
  },
  { timestamps: true },
);

export default mongoose.models.Appearance ||
  mongoose.model<IAppearance>('Appearance', AppearanceSchema);
