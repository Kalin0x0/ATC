-- ATC Example Shop — reference plugin demonstrating ATC SDK usage
ATC = ATC or {}

local ITEMS = {
    { id='water_bottle', name='Water Bottle', price=50,  description='Restores thirst' },
    { id='burger',       name='Burger',       price=150, description='Restores hunger'  },
    { id='bandage',      name='Bandage',      price=200, description='Restores 15 HP'   },
}

local SHOP_COORDS = vector3(24.47, -1346.64, 29.5)  -- 24/7 shop

-- Get shop inventory
ATC.Firewall.On('atc:example_shop:catalog', {clientAllowed=true,requireSession=true,rateLimit={window=5000,max=5}}, function(src)
    TriggerClientEvent('atc:example_shop:catalog:response', src, ITEMS)
end)

-- Buy item
ATC.Firewall.On('atc:example_shop:buy', {clientAllowed=true,requireSession=true,rateLimit={window=2000,max=10}}, function(src, payload)
    local itemId = type(payload)=='table' and tostring(payload.itemId or ''):sub(1,64) or ''
    local item
    for _, i in ipairs(ITEMS) do
        if i.id == itemId then item = i; break end
    end
    if not item then TriggerClientEvent('atc:example_shop:buy:result', src, { success=false, reason='not_found' }); return end

    -- Charge via economy SDK
    local principalId = ATC.Accounts.GetPrincipalId(src)
    if not principalId then return end
    if not ATC.EconomyPlugin then
        TriggerClientEvent('atc:example_shop:buy:result', src, { success=false, reason='economy_unavailable' })
        return
    end
    ATC.EconomyPlugin.Charge(src, item.price, 'shop_'..itemId, function(ok, walletData)
        if not ok then TriggerClientEvent('atc:example_shop:buy:result', src, { success=false, reason='insufficient_funds' }); return end
        -- Add item to inventory
        local characterId = ATC.Sessions.GetCharacterId(src)
        if characterId then
            ATC.HTTP.Post('/api/v1/inventory/add', { characterId=characterId, itemName=itemId, quantity=1, metadata={} }, function() end)
        end
        TriggerClientEvent('atc:example_shop:buy:result', src, { success=true, item=item, wallet=walletData })
    end)
end)
