import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser {
  _id?: string;
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'super_admin';
  allowedPages?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserMethods {
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type UserModel = mongoose.Model<IUser, {}, IUserMethods>;

const UserSchema = new mongoose.Schema<IUser, UserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address',
      ],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: ['admin', 'super_admin'],
      default: 'admin',
    },
    allowedPages: {
      type: [String],
      enum: [
        'products',
        'orders',
        'coupons',
        'countries',
        'users',
        'referrals',
        'activityLogs',
        'paymentSettings',
        'appearance',
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare passwords
UserSchema.methods.comparePassword = async function (
  candidatePassword: string,
): Promise<boolean> {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Prevent model recompilation in Next.js development
// Delete the model if it exists to ensure methods are properly attached
if (mongoose.models.User) {
  delete mongoose.models.User;
}

const User: UserModel = mongoose.model<IUser, UserModel>('User', UserSchema);

export default User;
