import { Controller, Get, Post, Body, Param, HttpCode } from '@nestjs/common';
import { ProviderService } from './provider.service';

@Controller()
export class ProviderController {
  constructor(private readonly providerService: ProviderService) {}

  @Post('messages')
  @HttpCode(200)
  async sendMessage(@Body() body: any) {
    return this.providerService.sendMessage(body);
  }

  @Post('simulate/inbound')
  @HttpCode(200)
  async simulateInbound(@Body() body: any) {
    return this.providerService.simulateInbound(body);
  }

  @Get('messages/:id')
  getMessage(@Param('id') id: string) {
    return this.providerService.getMessage(id);
  }

  @Get('config')
  getConfig() {
    return this.providerService.getConfig();
  }

  @Post('config')
  @HttpCode(200)
  updateConfig(@Body() body: any) {
    return this.providerService.updateConfig(body);
  }

  @Get('health')
  getHealth() {
    return this.providerService.getHealth();
  }

  @Get('stats')
  getStats() {
    return this.providerService.getStats();
  }
}
