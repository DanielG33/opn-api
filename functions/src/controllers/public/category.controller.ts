import { Request, Response } from 'express';
import { getEpisodesBySubcategories } from '../../services/episode.service';
import { categories } from '../../services/category.service';

export const getCategoryContent = async (req: Request, res: Response): Promise<any> => {
  try {
    const { categoryId } = req.params;
    const limit = parseInt(req.query.limit as string) || 10;

    // Find the category and its subcategories
    const category = categories.find(cat => cat.id === categoryId);
    
    if (!category) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Get subcategory IDs
    const subcategoryIds = category.subcategories.map(sub => sub.id);

    // Fetch episodes grouped by subcategories
    const episodesBySubcategory = await getEpisodesBySubcategories(categoryId, subcategoryIds, limit);

    res.status(200).json({
      success: true,
      data: {
        category: {
          id: category.id,
          title: category.title
        },
        subcategories: category.subcategories,
        episodes: episodesBySubcategory
      }
    });
  } catch (error) {
    console.error('Error fetching category content:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category content'
    });
  }
};
