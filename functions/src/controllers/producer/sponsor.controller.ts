import { Request, Response } from 'express';
import {
    getSponsorsBySeries,
    getSponsorById,
    createSponsor,
    updateSponsor,
    deleteSponsor
} from '../../services/sponsor.service';

export const listSponsors = async (req: Request, res: Response) => {
    // TODO: check if requested series belongs to requester token
    const { seriesId } = req.params;
    try {
        const sponsors = await getSponsorsBySeries(seriesId);
        res.json({ success: true, data: sponsors });
    } catch (err) {
        res.status(500).json({ success: false, error: { message: 'Failed to fetch sponsors' } });
    }
};

export const getSponsor = async (req: Request, res: Response) => {
    // TODO: check if requested sponsor belongs to requester token
    const { seriesId, sponsorId } = req.params;
    const sponsor = await getSponsorById(seriesId, sponsorId);
    if (!sponsor)
        return res.status(404).json({ message: 'Sponsor not found' });

    return res.json({ success: true, data: sponsor });
};

export const createSponsorController = async (req: Request, res: Response) => {
    // TODO: check if requested series belongs to requester token
    const { seriesId } = req.params;
    try {
        const sponsor = await createSponsor(seriesId, req.body);
        res.status(201).json({ success: true, data: sponsor });
    } catch (err: any) {
        res.status(422).json({ success: false, error: { message: err.message } });
    }
};

export const updateSponsorController = async (req: Request, res: Response) => {
    // TODO: check if requested sponsor belongs to requester token
    const { seriesId, sponsorId } = req.params;
    try {
        const updated = await updateSponsor(seriesId, sponsorId, req.body);
        res.json({ success: true, data: updated });
    } catch (err) {
        res.status(422).json({ success: false, error: { message: 'Failed to update sponsor' } });
    }
};

export const deleteSponsorController = async (req: Request, res: Response) => {
    // TODO: check if requested sponsor belongs to requester token
    const { seriesId, sponsorId } = req.params;
    try {
        await deleteSponsor(seriesId, sponsorId);
        res.json({ success: true, message: 'Sponsor deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: { message: 'Failed to delete sponsor' } });
    }
};
