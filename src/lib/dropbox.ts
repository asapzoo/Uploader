import { Dropbox } from 'dropbox';

export interface DropboxFile {
  name: string;
  path_lower: string;
  id: string;
}

export class DropboxService {
  private dbx: Dropbox;

  constructor(config: { accessToken?: string; refreshToken?: string; clientId?: string; clientSecret?: string }) {
    this.dbx = new Dropbox({ 
      accessToken: config.accessToken,
      refreshToken: config.refreshToken,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      fetch: window.fetch.bind(window)
    });
  }

  async listFiles(path: string = ''): Promise<DropboxFile[]> {
    try {
      const response = await this.dbx.filesListFolder({ path });
      return response.result.entries
        .filter((entry): entry is any => entry['.tag'] === 'file')
        .map(entry => ({
          name: entry.name,
          path_lower: entry.path_lower!,
          id: entry.id
        }));
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async downloadFile(path: string): Promise<string> {
    try {
      const response = await this.dbx.filesDownload({ path });
      const fileBlob = (response.result as any).fileBlob;
      return await fileBlob.text();
    } catch (error: any) {
      if (error.status === 409) {
        console.error('Dropbox 409: File non trovato al percorso:', path);
        throw new Error(`File non trovato su Dropbox al percorso "${path}". Assicurati che il file esista e che il percorso inizi con "/".`);
      }
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async uploadFile(path: string, content: string): Promise<void> {
    try {
      await this.dbx.filesUpload({
        path,
        contents: content,
        mode: { '.tag': 'overwrite' },
        mute: true
      });
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async getTemporaryLink(path: string): Promise<string> {
    try {
      const response = await this.dbx.filesGetTemporaryLink({ path });
      return response.result.link;
    } catch (error) {
      console.error('Error getting temporary link:', error);
      throw error;
    }
  }
}
