import { Request, Response } from "express";
import cryptoRandomString from 'crypto-random-string';
import { getSectionsOrder, getPageBlocks, updateSeriesPageBlock } from "../../services/series-page.service";

export const getBlocks = async (req: Request, res: Response) => {
    const seriesId: string = String(req.query['seriesId']);

    try {
        const blocks = await getPageBlocks(seriesId);
        return res.json({ success: true, data: blocks });
    } catch (error: any) {
        return res.status(422).json({
            success: false,
            error: {
                code: error.code || "unknown",
                message: error.message
            }
        });
    }
}

export const updateBlocksOrder = async (req: Request, res: Response) => {
    const { data }: { data: any[], type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);

    const targetValue = {
        sectionsOrder: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ["sectionsOrder"] });
    return res.json({ success: true, data: targetValue });
}

export const updateHeroBanner = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        heroBanner: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({ success: true, data: targetValue });
}

export const updatePoster = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        leftPoster: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({ success: true, data: targetValue });
}

export const updateCta = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        cta: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({ success: true, data: targetValue });
}

export const updateDetails = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        ...data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({ success: true, data: targetValue });
}

export const updateNetworks = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        socialNetworks: { ...data },
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue)
    return res.json({ success: true, data: targetValue });
}

export const updateEpisodeSliders = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);

    const sectionsOrder = await getSectionsOrder(seriesId);

    const episodes_sliders = data.reduce((acc: any, obj: any) => {
        const id = obj.id || `slider_${cryptoRandomString({ length: 10 })}`;

        if (!obj.id) {
            sectionsOrder.push(id)
        }

        acc[id] = { ...obj, id };
        return acc;
    }, {});

    const targetValue = {
        episodes_sliders,
        sectionsOrder,
        updatedAt: Date.now()
    };

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ['episodes_sliders', 'sectionsOrder'] })
    return res.json({ success: true, data: targetValue });
}

export const updateGalleries = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const sectionsOrder = await getSectionsOrder(seriesId);

    const galleries = data.reduce((acc: any, obj: any) => {
        const id = obj.id || `gallery_${cryptoRandomString({ length: 10 })}`;

        if (!obj.id) {
            sectionsOrder.push(id)
        }

        acc[id] = { ...obj, id };
        return acc;
    }, {});

    const targetValue = {
        galleries,
        sectionsOrder,
        updatedAt: Date.now()
    };

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ['galleries', 'sectionsOrder'] });
    return res.json({ success: true, data: targetValue });
}

export const updateBanners = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const sectionsOrder = await getSectionsOrder(seriesId);

    const banners = data.reduce((acc: any, obj: any) => {
        const id = obj.id || `banner_${cryptoRandomString({ length: 10 })}`;

        if (!obj.id) {
            sectionsOrder.push(id)
        }

        acc[id] = { ...obj, id };
        return acc;
    }, {});

    const targetValue = {
        banners,
        sectionsOrder,
        updatedAt: Date.now()
    };

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ['banners', 'sectionsOrder'] });
    return res.json({ success: true, data: targetValue });
}

export const updateAds = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);

    const ads = data.reduce((acc: any, obj: any) => {
        const id = obj.id || `ad_${cryptoRandomString({ length: 10 })}`;
        acc[id] = { ...obj, id };
        return acc;
    }, {})

    const targetValue = {
        ads,
        updatedAt: Date.now()
    };

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ['ads'] });
    return res.json({ success: true, data: targetValue });
}

export const updateSponsorSliders = async (req: Request, res: Response) => {
    const { data }: { data: any, type: string } = req.body;
    const seriesId: string = String(req.query['seriesId']);
    const targetValue = {
        sponsorsSlider: data,
        updatedAt: Date.now()
    }

    await updateSeriesPageBlock(seriesId, targetValue, { mergeFields: ["sponsorsSlider"] })
    return res.json({ success: true, data: targetValue });
}
