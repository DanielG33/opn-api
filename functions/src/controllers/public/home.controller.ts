import { Request, Response } from 'express';
import { getRandomEpisodes, getLatestEpisodes, getEpisodesByCategory } from '../../services/episode.service';

export const getHomeContent = async (req: Request, res: Response) => {
  try {
    // Fetch episodes for different carousels
    const [
      trendingEpisodes,
      latestEpisodes,
      huntingEpisodes,
      fishingEpisodes,
      shootingEpisodes,
      adventureEpisodes,
      motorsportEpisodes,
      lifestyleEpisodes
    ] = await Promise.allSettled([
      getRandomEpisodes(10),
      getLatestEpisodes(10),
      getEpisodesByCategory('hunting', 10),
      getEpisodesByCategory('fishing', 10),
      getEpisodesByCategory('shooting', 10),
      getEpisodesByCategory('adventure', 10),
      getEpisodesByCategory('motorsport', 10),
      getEpisodesByCategory('lifestyle', 10)
    ]);

    // Helper to extract fulfilled results
    const getResult = (result: PromiseSettledResult<any[]>) => 
      result.status === 'fulfilled' ? result.value : [];

    const carousels: any = {};
    
    // Only include carousels that have content
    const trending = getResult(trendingEpisodes);
    if (trending.length > 0) carousels.trending = trending;
    
    const latest = getResult(latestEpisodes);
    if (latest.length > 0) carousels.latest = latest;
    
    const hunting = getResult(huntingEpisodes);
    if (hunting.length > 0) carousels.hunting = hunting;
    
    const fishing = getResult(fishingEpisodes);
    if (fishing.length > 0) carousels.fishing = fishing;
    
    const shooting = getResult(shootingEpisodes);
    if (shooting.length > 0) carousels.shooting = shooting;
    
    const adventure = getResult(adventureEpisodes);
    if (adventure.length > 0) carousels.adventure = adventure;
    
    const motorsport = getResult(motorsportEpisodes);
    if (motorsport.length > 0) carousels.motorsport = motorsport;
    
    const lifestyle = getResult(lifestyleEpisodes);
    if (lifestyle.length > 0) carousels.lifestyle = lifestyle;

    // Return home content with carousels
    res.status(200).json({
      success: true,
      data: {
        heroBanner: [
          {
            type: 'image',
            image: {
              id: 'image-1',
              name: 'Image 1',
              type: 'image',
              url: 'https://firebasestorage.googleapis.com/v0/b/opnnetwork-207317.appspot.com/o/header%2Fhome%2Fjumpstory-download20200521-040513-min.jpg?alt=media&token=9357a188-7780-47a2-84b1-23f98d6eab22',
            }
          },
          {
            type: 'image',
            image: {
              id: 'image-2',
              name: 'Image 2',
              type: 'image',
              url: 'https://firebasestorage.googleapis.com/v0/b/opnnetwork-207317.appspot.com/o/header%2Fhome%2Fjumpstory-download20200521-041543-min.jpg?alt=media&token=006d10e4-2fc2-4274-b768-deed7c4a58ac',
            }
          },
          {
            type: 'image',
            image: {
              id: 'image-3',
              name: 'Image 3',
              type: 'image',
              url: 'https://firebasestorage.googleapis.com/v0/b/opnnetwork-207317.appspot.com/o/header%2Fhome%2Fjumpstory-download20200521-041936-min.jpg?alt=media&token=b781b175-8ecb-4c85-88fd-64744678bf4d',
            }
          },
          {
            type: 'image',
            image: {
              id: 'image-4',
              name: 'Image 4',
              type: 'image',
              url: 'https://firebasestorage.googleapis.com/v0/b/opnnetwork-207317.appspot.com/o/header%2Fhome%2Fjumpstory-download20200521-042702-min.jpg?alt=media&token=ef4d1964-5952-4a37-b615-cf66ec94d369',
            }
          },
        ],
        carousels,
        promoCarousel: []
      }
    });
  } catch (error) {
    console.error('Error fetching home content:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch home content' 
    });
  }
};
