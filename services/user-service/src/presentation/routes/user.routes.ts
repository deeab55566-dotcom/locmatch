import { Router, Request, Response } from 'express';
import multer from 'multer';
import { UserController } from '../controllers/UserController';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

export function createUserRoutes(controller: UserController): Router {
  const router = Router();

  // Profile endpoints
  router.get('/profile', (req: Request, res: Response) => controller.getProfile(req, res));
  router.put('/profile', (req: Request, res: Response) => controller.updateProfile(req, res));
  router.get('/public/:userId', (req: Request, res: Response) => controller.getPublicProfile(req, res));

  // Photo upload
  router.post('/profile/photo', upload.single('photo'), (req: Request, res: Response) => controller.uploadPhoto(req, res));

  // Activity endpoints
  router.get('/activity', (req: Request, res: Response) => controller.getActivity(req, res));

  // Follow endpoints
  router.post('/:id/follow', (req: Request, res: Response) => controller.followUser(req, res));
  router.delete('/:id/follow', (req: Request, res: Response) => controller.unfollowUser(req, res));
  router.get('/followers', (req: Request, res: Response) => controller.getFollowers(req, res));
  router.get('/following', (req: Request, res: Response) => controller.getFollowing(req, res));
  router.delete('/followers/:followerId', (req: Request, res: Response) => controller.removeFollower(req, res));

  // Search / discover endpoints
  router.get('/search', (req: Request, res: Response) => controller.searchUsers(req, res));
  router.get('/search/interests', (req: Request, res: Response) => controller.searchByInterests(req, res));
  router.get('/discover', (req: Request, res: Response) => controller.discoverUsers(req, res));

  // Health check
  router.get('/health', (req: Request, res: Response) => res.json({ status: 'ok' }));

  return router;
}